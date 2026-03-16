import { DynamoDBClient, GetItemCommand, PutItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { authenticator } from "otplib";

const db = new DynamoDBClient({ region: process.env.AWS_REGION });
const USERS_TABLE = process.env.USERS_TABLE || "securebase-users";
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = process.env.JWT_EXPIRY || "1h";

const response = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": process.env.CORS_ORIGIN || "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
  },
  body: JSON.stringify(body),
});

const getUser = async (email) => {
  const result = await db.send(new GetItemCommand({
    TableName: USERS_TABLE,
    Key: marshall({ email }),
  }));
  return result.Item ? unmarshall(result.Item) : null;
};

const login = async (body) => {
  const { email, password, totp_code } = body;
  if (!email || !password) return response(400, { message: "Email and password required" });
  const user = await getUser(email);
  if (!user) return response(401, { message: "Invalid credentials" });
  const passwordMatch = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatch) return response(401, { message: "Invalid credentials" });
  if (user.mfa_enabled) {
    if (!totp_code) return response(200, { mfa_required: true, message: "TOTP code required" });
    const valid = authenticator.verify({ token: totp_code, secret: user.mfa_secret });
    if (!valid) return response(401, { message: "Invalid TOTP code" });
  }
  const token = jwt.sign(
    { sub: user.email, role: user.role || "user" },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
  return response(200, { token, user: { email: user.email, role: user.role, mfa_enabled: user.mfa_enabled } });
};

const register = async (body) => {
  const { email, password } = body;
  if (!email || !password) return response(400, { message: "Email and password required" });
  if (password.length < 8) return response(400, { message: "Password must be at least 8 characters" });
  const existing = await getUser(email);
  if (existing) return response(409, { message: "User already exists" });
  const password_hash = await bcrypt.hash(password, 12);
  await db.send(new PutItemCommand({
    TableName: USERS_TABLE,
    Item: marshall({ email, password_hash, role: "user", mfa_enabled: false, created_at: new Date().toISOString() }),
  }));
  return response(201, { message: "User created successfully" });
};

const mfaSetup = async (body) => {
  const { email } = body;
  const user = await getUser(email);
  if (!user) return response(404, { message: "User not found" });
  const secret = authenticator.generateSecret();
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

export const handler = async (event) => {
  try {
    const path = event.path || event.rawPath || "";
    const method = event.httpMethod || event.requestContext?.http?.method || "";
    const body = event.body ? JSON.parse(event.body) : {};
    if (method === "OPTIONS") return response(200, {});
    if (method === "POST" && path.endsWith("/auth/login"))      return await login(body);
    if (method === "POST" && path.endsWith("/auth/register"))   return await register(body);
    if (method === "POST" && path.endsWith("/auth/mfa/setup"))  return await mfaSetup(body);
    if (method === "POST" && path.endsWith("/auth/mfa/verify")) return await mfaVerify(body);
    return response(404, { message: "Not found" });
  } catch (err) {
    console.error("Auth Lambda error:", err);
    return response(500, { message: "Internal server error" });
  }
};
