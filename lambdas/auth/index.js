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
const FROM_EMAIL   = process.env.FROM_EMAIL    || "onboarding@tximhotep.com";
const TOKEN_TTL_H  = 24; // hours

const response = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": process.env.CORS_ORIGIN || "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
  },
  body: JSON.stringify(body),
});

// ── helpers ────────────────────────────────────────────────────────────────

const getUser = async (email) => {
  const r = await db.send(new GetItemCommand({ TableName: USERS_TABLE, Key: marshall({ email }) }));
  return r.Item ? unmarshall(r.Item) : null;
};

const generateToken = () => crypto.randomBytes(32).toString("hex");

const storeToken = async (email, token, type) => {
  const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_H * 3600;
  await db.send(new PutItemCommand({
    TableName: TOKENS_TABLE,
    Item: marshall({ token, email, type, expiresAt, used: false }),
  }));
};

const consumeToken = async (token, type) => {
  const r = await db.send(new GetItemCommand({ TableName: TOKENS_TABLE, Key: marshall({ token }) }));
  if (!r.Item) return null;
  const item = unmarshall(r.Item);
  const now  = Math.floor(Date.now() / 1000);
  if (item.type !== type || item.used || item.expiresAt < now) return null;
  await db.send(new UpdateItemCommand({
    TableName: TOKENS_TABLE,
    Key: marshall({ token }),
    UpdateExpression: "SET #u = :t",
    ExpressionAttributeNames:  { "#u": "used" },
    ExpressionAttributeValues: marshall({ ":t": true }),
  }));
  return item;
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
    <h1 style="color:#0066CC;margin:8px 0 0">SecureBase</h1>
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
    Questions? <a href="mailto:support@securebase.tximhotep.com">support@securebase.tximhotep.com</a>
  </p>
</div>`;

// ── auth handlers ──────────────────────────────────────────────────────────

const login = async (body) => {
  const { email, password, totp_code } = body;
  if (!email || !password) return response(400, { message: "Email and password required" });
  const user = await getUser(email);
  if (!user || !user.password_hash) return response(401, { message: "Invalid credentials" });
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return response(401, { message: "Invalid credentials" });
  if (user.mfa_enabled) {
    if (!totp_code) return response(200, { mfa_required: true });
    const valid = authenticator.verify({ token: totp_code, secret: user.mfa_secret });
    if (!valid) return response(401, { message: "Invalid TOTP code" });
  }
  const token = jwt.sign(
    { sub: user.email, role: user.role || "user", mfa_enabled: !!user.mfa_enabled },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY },
  );
  return response(200, { token, user: { email: user.email, role: user.role, mfa_enabled: user.mfa_enabled } });
};

const register = async (body) => {
  const { email, password } = body;
  if (!email || !password) return response(400, { message: "Email and password required" });
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

// Invite — admin-initiated: creates/updates user record (no password yet) and sends set-password email
const invite = async (body) => {
  const { email, invited_by } = body;
  if (!email) return response(400, { message: "Email required" });
  const existing = await getUser(email);
  if (!existing) {
    // Provision stub record so the user exists before they set their password
    await db.send(new PutItemCommand({
      TableName: USERS_TABLE,
      Item: marshall({ email, role: "user", mfa_enabled: false, status: "invited", created_at: new Date().toISOString() }),
    }));
  }
  const token = generateToken();
  await storeToken(email, token, "invite");
  const link = `${APP_URL}/accept-invite?token=${token}`;
  const html = emailHtml(
    "You're invited to SecureBase",
    `<p>Hi,</p>
     <p>${invited_by || "The SecureBase team"} has granted you access to the SecureBase Healthcare compliance portal.</p>
     <p>Click below to set your password and activate your account. Your 30-day pilot begins the moment you log in.</p>`,
    "Activate Your Account →",
    link,
  );
  await sendEmail(email, "Activate your SecureBase account", html);
  console.log(`Invite sent to ${email}`);
  return response(200, { message: "Invite sent" });
};

// Accept invite — user sets password via link from email
const acceptInvite = async (body) => {
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
  // Issue JWT so the user is logged in immediately after setting password
  const user = await getUser(item.email);
  const jwt_token = jwt.sign(
    { sub: user.email, role: user.role || "user", mfa_enabled: false },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY },
  );
  return response(200, { token: jwt_token, user: { email: user.email, role: user.role, mfa_enabled: false } });
};

// Forgot password — sends reset link
const forgotPassword = async (body) => {
  const { email } = body;
  if (!email) return response(400, { message: "Email required" });
  const user = await getUser(email);
  // Always return 200 to prevent email enumeration
  if (!user) return response(200, { message: "If that email exists, a reset link has been sent" });
  const token = generateToken();
  await storeToken(email, token, "reset");
  const link = `${APP_URL}/reset-password?token=${token}`;
  const html = emailHtml(
    "Reset your SecureBase password",
    `<p>We received a request to reset the password for your SecureBase account.</p>
     <p>Click below to choose a new password. This link expires in ${TOKEN_TTL_H} hours.</p>`,
    "Reset Password →",
    link,
  );
  await sendEmail(email, "Reset your SecureBase password", html);
  return response(200, { message: "If that email exists, a reset link has been sent" });
};

// Reset password — user sets new password via link
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
  const { email } = body;
  const user = await getUser(email);
  if (!user) return response(404, { message: "User not found" });
  const secret  = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(email, "SecureBase", secret);
  await db.send(new UpdateItemCommand({
    TableName: USERS_TABLE,
    Key: marshall({ email }),
    UpdateExpression: "SET mfa_secret_pending = :s",
    ExpressionAttributeValues: marshall({ ":s": secret }),
  }));
  return response(200, { secret, otpauth_url: otpauth });
};

const mfaVerify = async (body) => {
  const { email, totp_code } = body;
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

// ── router ─────────────────────────────────────────────────────────────────

export const handler = async (event) => {
  try {
    const path   = event.path || event.rawPath || "";
    const method = event.httpMethod || event.requestContext?.http?.method || "";
    const body   = event.body ? JSON.parse(event.body) : {};
    if (method === "OPTIONS") return response(200, {});
    if (method === "POST" && path.endsWith("/auth/login"))           return await login(body);
    if (method === "POST" && path.endsWith("/auth/register"))        return await register(body);
    if (method === "POST" && path.endsWith("/auth/invite"))          return await invite(body);
    if (method === "POST" && path.endsWith("/auth/accept-invite"))   return await acceptInvite(body);
    if (method === "POST" && path.endsWith("/auth/forgot-password")) return await forgotPassword(body);
    if (method === "POST" && path.endsWith("/auth/reset-password"))  return await resetPassword(body);
    if (method === "POST" && path.endsWith("/auth/mfa/setup"))       return await mfaSetup(body);
    if (method === "POST" && path.endsWith("/auth/mfa/verify"))      return await mfaVerify(body);
    return response(404, { message: "Not found" });
  } catch (err) {
    console.error("Auth Lambda error:", err);
    return response(500, { message: "Internal server error" });
  }
};
