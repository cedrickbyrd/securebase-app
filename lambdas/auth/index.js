import { DynamoDBClient, GetItemCommand, PutItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { authenticator } from "otplib";
import crypto from "crypto";

const db  = new DynamoDBClient({ region: process.env.AWS_REGION });
const ses = new SESClient({ region: process.env.AWS_SES_REGION || "us-east-1" });

const USERS_TABLE  = process.env.USERS_TABLE  || "securebase-users";
const TOKENS_TABLE = process.env.TOKENS_TABLE || "securebase-tokens";
const JWT_SECRET   = process.env.JWT_SECRET;
const JWT_EXPIRY   = process.env.JWT_EXPIRY   || "1h";
const APP_URL      = process.env.APP_URL       || "https://portal.securebase.tximhotep.com";
const APP_NAME     = process.env.APP_NAME      || "SecureBase";
const FROM_EMAIL    = process.env.FROM_EMAIL     || "onboarding@tximhotep.com";
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL  || "support@securebase.tximhotep.com";
const TOKEN_TTL_H  = 24; // hours
// Brute-force protection: lock account after this many consecutive bad passwords.
const MAX_FAILED_ATTEMPTS = parseInt(process.env.MAX_FAILED_LOGIN_ATTEMPTS || "5", 10);
// Account lockout window in seconds (default 15 minutes).
const LOCKOUT_TTL_S = parseInt(process.env.LOCKOUT_DURATION_SECONDS || "900", 10);
// Portal origin used for CORS — must be explicit (never "*") to support credentials.
const CORS_ORIGIN = process.env.CORS_ORIGIN || "https://portal.securebase.tximhotep.com";
const ACCEPT_INVITE_PATH_PATTERN = /(?:^|\/)accept-invite(?:\/|$)/;
const INVITE_PATH_PATTERN = /(?:^|\/)invite(?:\/|$)/;

// ── Cold-start guard: JWT_SECRET is required for all token operations ────────
if (!JWT_SECRET) {
  console.error("FATAL: JWT_SECRET environment variable is not set. Auth Lambda will not issue tokens.");
}

const response = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": CORS_ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  },
  body: JSON.stringify(body),
});

// ── helpers ───────────────────────────────────────────────────────────────────

const normalizeEmail = (raw) => (raw || "").toLowerCase().trim();

/** Lightweight email format check — non-backtracking to prevent ReDoS on uncontrolled input */
const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const at = email.indexOf('@');
  if (at < 1) return false;
  if (email.indexOf('@', at + 1) !== -1) return false; // reject multiple '@'
  const dot = email.lastIndexOf('.');
  return dot > at + 1 && dot < email.length - 1 && !email.includes(' ');
};

const getUser = async (email) => {
  const r = await db.send(new GetItemCommand({ TableName: USERS_TABLE, Key: marshall({ email }) }));
  return r.Item ? unmarshall(r.Item) : null;
};

/**
 * Increment the failed-login counter for an email.
 * If the counter reaches MAX_FAILED_ATTEMPTS the record gains a
 * `locked_until` epoch (seconds) so subsequent calls return early.
 */
const recordFailedLogin = async (email) => {
  const now = Math.floor(Date.now() / 1000);
  const lockedUntil = now + LOCKOUT_TTL_S;
  await db.send(new UpdateItemCommand({
    TableName: USERS_TABLE,
    Key: marshall({ email }),
    UpdateExpression:
      "SET failed_login_attempts = if_not_exists(failed_login_attempts, :zero) + :one, " +
      "locked_until = if_not_exists(locked_until, :unlocked)",
    ExpressionAttributeValues: marshall({
      ":zero": 0,
      ":one": 1,
      ":unlocked": 0,
    }),
  }));
  // Re-read to decide whether we just tripped the lockout threshold.
  const updated = await getUser(email);
  const attempts = updated?.failed_login_attempts || 0;
  if (attempts >= MAX_FAILED_ATTEMPTS) {
    await db.send(new UpdateItemCommand({
      TableName: USERS_TABLE,
      Key: marshall({ email }),
      UpdateExpression: "SET locked_until = :lu",
      ExpressionAttributeValues: marshall({ ":lu": lockedUntil }),
    }));
  }
};

/** Reset the failed-login counter and clear any lockout on a successful login. */
const clearFailedLogins = async (email) => {
  await db.send(new UpdateItemCommand({
    TableName: USERS_TABLE,
    Key: marshall({ email }),
    UpdateExpression: "SET failed_login_attempts = :zero REMOVE locked_until",
    ExpressionAttributeValues: marshall({ ":zero": 0 }),
  }));
};

const generateToken = () => crypto.randomBytes(32).toString("hex");

const storeToken = async (email, token, type) => {
  const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_H * 3600;
  await db.send(new PutItemCommand({
    TableName: TOKENS_TABLE,
    Item: marshall({ token, email, type, expiresAt, used: false }),
  }));
};

/**
 * Atomically mark a token as used using a conditional write.
 * The ConditionExpression ensures used=false, correct type, and not expired —
 * all in a single DynamoDB round-trip, closing the replay-attack window.
 */
const consumeToken = async (token, type) => {
  const now = Math.floor(Date.now() / 1000);
  try {
    const result = await db.send(new UpdateItemCommand({
      TableName: TOKENS_TABLE,
      Key: marshall({ token }),
      UpdateExpression: "SET #u = :t",
      ConditionExpression: "#u = :f AND #type = :type AND expiresAt > :now",
      ExpressionAttributeNames: { "#u": "used", "#type": "type" },
      ExpressionAttributeValues: marshall({ ":t": true, ":f": false, ":type": type, ":now": now }),
      ReturnValues: "ALL_NEW",
    }));
    return result.Attributes ? unmarshall(result.Attributes) : null;
  } catch (err) {
    if (err?.name === "ConditionalCheckFailedException") return null;
    throw err;
  }
};

const sendEmail = async (to, subject, html) => {
  await ses.send(new SendEmailCommand({
    Source: FROM_EMAIL,
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject },
      Body:    { Html: { Data: html } },
    },
  }));
};

const emailHtml = (heading, body, ctaLabel, ctaUrl) => `
<div style="font-family:sans-serif;max-width:560px;margin:auto;padding:32px;border:1px solid #e2e8f0;border-radius:12px">
  <div style="text-align:center;margin-bottom:24px">
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="8" fill="#0066CC"/>
      <path d="M20 10L30 16V24L20 30L10 24V16L20 10Z" fill="white"/>
    </svg>
    <h1 style="color:#0066CC;margin:8px 0 0">${APP_NAME}</h1>
  </div>
  <h2 style="color:#1a202c">${heading}</h2>
  ${body}
  <div style="text-align:center;margin:32px 0">
    <a href="${ctaUrl}"
       style="background:#0066CC;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;display:inline-block">
      ${ctaLabel}
    </a>
  </div>
  <p style="color:#64748b;font-size:13px;text-align:center">
    This link expires in ${TOKEN_TTL_H} hours. If you didn't request this, ignore this email.
  </p>
  <p style="color:#94a3b8;font-size:12px;text-align:center">
    Questions? <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>
  </p>
</div>`;

// ── auth handlers ─────────────────────────────────────────────────────────────

const login = async (body) => {
  // Guard: JWT_SECRET must be set to issue tokens
  if (!JWT_SECRET) return response(500, { message: "Auth service misconfigured" });

  const email = normalizeEmail(body.email);
  const { password, totp_code } = body;
  if (!email || !password) return response(400, { message: "Email and password required" });
  if (!isValidEmail(email)) return response(400, { message: "Invalid email address" });

  const user = await getUser(email);
  // Return 401 for both "user not found" and "invited but not yet activated" —
  // never leak which case applies (prevents user enumeration)
  if (!user || !user.password_hash) return response(401, { message: "Invalid credentials" });

  // Check account lockout before bcrypt to avoid timing side-channel
  const now = Math.floor(Date.now() / 1000);
  if (user.locked_until && user.locked_until > now) {
    const retryAfter = user.locked_until - now;
    return {
      statusCode: 429,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": CORS_ORIGIN,
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Retry-After": String(retryAfter),
      },
      body: JSON.stringify({ message: "Too many failed login attempts. Please try again later." }),
    };
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    await recordFailedLogin(email);
    return response(401, { message: "Invalid credentials" });
  }

  // Successful auth — clear brute-force counters
  await clearFailedLogins(email);

  if (user.mfa_enabled) {
    if (!totp_code) return response(200, { mfa_required: true });
    const valid = authenticator.verify({ token: totp_code, secret: user.mfa_secret });
    if (!valid) return response(401, { message: "Invalid TOTP code" });
  }
  if (!user.first_login_at) {
    const firstLoginAt = new Date().toISOString();
    try {
      await db.send(new UpdateItemCommand({
        TableName: USERS_TABLE,
        Key: marshall({ email }),
        UpdateExpression: "SET first_login_at = :t",
        ConditionExpression: "attribute_not_exists(first_login_at)",
        ExpressionAttributeValues: marshall({ ":t": firstLoginAt }),
      }));
      user.first_login_at = firstLoginAt;
    } catch (err) {
      if (err?.name === "ConditionalCheckFailedException") {
        const latestUser = await getUser(email);
        if (!latestUser?.first_login_at) {
          throw new Error("first_login_at could not be read after conditional write failure; possible consistency delay");
        }
        user.first_login_at = latestUser.first_login_at;
      } else {
        console.error("Failed to set first_login_at:", err);
        throw err;
      }
    }
  }
  const token = jwt.sign(
    { sub: user.email, role: user.role || "user", mfa_enabled: !!user.mfa_enabled },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY },
  );
  return response(200, {
    token,
    user: {
      email: user.email,
      role: user.role,
      mfa_enabled: user.mfa_enabled,
      first_login_at: user.first_login_at || null,
    },
  });
};

const register = async (body) => {
  const email = normalizeEmail(body.email);
  const { password } = body;
  if (!email || !password) return response(400, { message: "Email and password required" });
  if (!isValidEmail(email)) return response(400, { message: "Invalid email address" });
  if (password.length < 8)  return response(400, { message: "Password must be at least 8 characters" });
  const existing = await getUser(email);
  if (existing && existing.password_hash) return response(409, { message: "User already exists" });
  const password_hash = await bcrypt.hash(password, 12);
  await db.send(new PutItemCommand({
    TableName: USERS_TABLE,
    Item: marshall({ email, password_hash, role: "user", mfa_enabled: false, created_at: new Date().toISOString() }),
  }));
  return response(201, { message: "User created successfully" });
};

const invite = async (body) => {
  const email = normalizeEmail(body.email);
  const { invited_by } = body;
  if (!email) return response(400, { message: "Email required" });
  if (!isValidEmail(email)) return response(400, { message: "Invalid email address" });

  const existing = await getUser(email);
  if (!existing) {
    await db.send(new PutItemCommand({
      TableName: USERS_TABLE,
      Item: marshall({ email, role: "user", mfa_enabled: false, status: "invited", created_at: new Date().toISOString() }),
    }));
  }
  const token = generateToken();
  await storeToken(email, token, "invite");
  const link = `${APP_URL}/accept-invite?token=${token}`;
  const html = emailHtml(
    `You're invited to ${APP_NAME}`,
    `<p>Hi,</p>
     <p>${invited_by || `The ${APP_NAME} team`} has granted you access to the ${APP_NAME} Healthcare compliance portal.</p>
     <p>Click below to set your password and activate your account. Your 30-day pilot begins the moment you log in.</p>`,
    "Activate Your Account →",
    link,
  );
  try {
    await sendEmail(email, `Activate your ${APP_NAME} account`, html);
  } catch (sesErr) {
    console.error("SES send failed for invite — token stored, email not delivered:", sesErr);
  }
  console.log("Invite processed [redacted]");
  return response(200, { message: "Invite sent" });
};

const acceptInvite = async (body) => {
  // Guard: JWT_SECRET must be set to issue tokens
  if (!JWT_SECRET) return response(500, { message: "Auth service misconfigured" });

  const { token, password } = body;
  if (!token || !password) return response(400, { message: "Token and password required" });
  if (password.length < 8)  return response(400, { message: "Password must be at least 8 characters" });
  const item = await consumeToken(token, "invite");
  if (!item) return response(400, { message: "Invalid or expired invite link" });
  const password_hash = await bcrypt.hash(password, 12);
  await db.send(new UpdateItemCommand({
    TableName: USERS_TABLE,
    Key: marshall({ email: item.email }),
    UpdateExpression: "SET password_hash = :h, #st = :s",
    ExpressionAttributeNames:  { "#st": "status" },
    ExpressionAttributeValues: marshall({ ":h": password_hash, ":s": "active" }),
  }));
  const user = await getUser(item.email);
  const jwt_token = jwt.sign(
    { sub: user.email, role: user.role || "user", mfa_enabled: false },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY },
  );
  return response(200, { token: jwt_token, user: { email: user.email, role: user.role, mfa_enabled: false } });
};

const forgotPassword = async (body) => {
  const email = normalizeEmail(body.email);
  if (!email) return response(400, { message: "Email required" });
  if (!isValidEmail(email)) return response(400, { message: "Invalid email address" });

  const user = await getUser(email);
  // Always return 200 — never leak whether the email exists
  if (!user) return response(200, { message: "If that email exists, a reset link has been sent" });

  const token = generateToken();

  // Guard: if we can't persist the token, log and return the same uniform response to
  // prevent user enumeration — a 503 only for existing users would be an enumeration signal.
  try {
    await storeToken(email, token, "reset");
  } catch (dbErr) {
    console.error("DynamoDB storeToken failed for forgot-password:", dbErr);
    return response(200, { message: "If that email exists, a reset link has been sent" });
  }

  const link = `${APP_URL}/reset-password?token=${token}`;
  const html = emailHtml(
    `Reset your ${APP_NAME} password`,
    `<p>We received a request to reset the password for your ${APP_NAME} account.</p>
     <p>Click below to choose a new password. This link expires in ${TOKEN_TTL_H} hours.</p>`,
    "Reset Password →",
    link,
  );

  try {
    await sendEmail(email, `Reset your ${APP_NAME} password`, html);
  } catch (sesErr) {
    console.error("SES send failed for forgot-password — token stored, email not delivered:", sesErr);
  }

  return response(200, { message: "If that email exists, a reset link has been sent" });
};

const resetPassword = async (body) => {
  const { token, password } = body;
  if (!token || !password) return response(400, { message: "Token and password required" });
  if (password.length < 8)  return response(400, { message: "Password must be at least 8 characters" });
  const item = await consumeToken(token, "reset");
  if (!item) return response(400, { message: "Invalid or expired reset link" });
  const password_hash = await bcrypt.hash(password, 12);
  await db.send(new UpdateItemCommand({
    TableName: USERS_TABLE,
    Key: marshall({ email: item.email }),
    UpdateExpression: "SET password_hash = :h",
    ExpressionAttributeValues: marshall({ ":h": password_hash }),
  }));
  return response(200, { message: "Password updated. You can now log in." });
};

const mfaSetup = async (body) => {
  // Null guard — missing email returns 400 not 500
  if (!body || !body.email) return response(400, { message: "Email required" });
  const email = normalizeEmail(body.email);
  if (!isValidEmail(email)) return response(400, { message: "Invalid email address" });
  const user = await getUser(email);
  // Return 400 (not 404) to avoid disclosing whether the account exists.
  if (!user) return response(400, { message: "MFA setup not available" });
  const secret  = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(email, APP_NAME, secret);
  await db.send(new UpdateItemCommand({
    TableName: USERS_TABLE,
    Key: marshall({ email }),
    UpdateExpression: "SET mfa_secret_pending = :s",
    ExpressionAttributeValues: marshall({ ":s": secret }),
  }));
  return response(200, { secret, otpauth_url: otpauth });
};

const mfaVerify = async (body) => {
  // Null guard — missing fields return 400 not 500
  if (!body || !body.email || !body.totp_code) return response(400, { message: "Email and totp_code required" });
  const email = normalizeEmail(body.email);
  const { totp_code } = body;
  const user = await getUser(email);
  if (!user || !user.mfa_secret_pending) return response(400, { message: "MFA setup not initiated" });
  const valid = authenticator.verify({ token: totp_code, secret: user.mfa_secret_pending });
  if (!valid) return response(401, { message: "Invalid TOTP code" });
  await db.send(new UpdateItemCommand({
    TableName: USERS_TABLE,
    Key: marshall({ email }),
    UpdateExpression: "SET mfa_secret = :s, mfa_enabled = :e REMOVE mfa_secret_pending",
    ExpressionAttributeValues: marshall({ ":s": user.mfa_secret_pending, ":e": true }),
  }));
  return response(200, { message: "MFA enabled successfully" });
};

// ── router ────────────────────────────────────────────────────────────────────

export const handler = async (event) => {
  try {
    const path   = event.path || "";
    const method = event.httpMethod || event.requestContext?.http?.method || "";
    const isAcceptInvitePath = ACCEPT_INVITE_PATH_PATTERN.test(path);
    const isInvitePath = INVITE_PATH_PATTERN.test(path) && !isAcceptInvitePath;
    if (method === "OPTIONS") {
      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": CORS_ORIGIN,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
        body: "",
      };
    }

    // Guard: malformed JSON body returns 400 instead of throwing a 500
    let body;
    try {
      body = typeof event.body === "string"
        ? (event.body ? JSON.parse(event.body) : {})
        : (event.body || {});
    } catch {
      return response(400, { message: "Invalid request body" });
    }

    if (method === "POST" && path.endsWith("/auth/login"))           return await login(body);
    if (method === "POST" && path.endsWith("/auth/register"))        return await register(body);
    if (method === "POST" && isAcceptInvitePath)                      return await acceptInvite(body);
    if (method === "POST" && isInvitePath)                            return await invite(body);
    if (method === "POST" && path.includes("/auth/forgot-password")) return await forgotPassword(body);
    if (method === "POST" && path.includes("/auth/reset-password"))  return await resetPassword(body);
    if (method === "POST" && path.endsWith("/auth/mfa/setup"))       return await mfaSetup(body);
    if (method === "POST" && path.endsWith("/auth/mfa/verify"))      return await mfaVerify(body);
    return response(404, { message: "Not found" });
  } catch (err) {
    console.error("Auth Lambda error:", err);
    return response(500, { message: "Internal server error" });
  }
};
