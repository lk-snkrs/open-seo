import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE_NAME = "lk_open_seo_session";

type SessionClaims = {
  version: 1;
  subject: string;
  email: string;
  expiresAt: number;
};

type SessionIdentity = {
  subject: string;
  email: string;
};

function sign(payload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(payload).digest();
}

function isSessionClaims(value: unknown): value is SessionClaims {
  if (!value || typeof value !== "object") return false;
  const claims = value as Partial<SessionClaims>;
  return (
    claims.version === 1 &&
    typeof claims.subject === "string" &&
    claims.subject.length > 0 &&
    typeof claims.email === "string" &&
    claims.email.length > 0 &&
    typeof claims.expiresAt === "number" &&
    Number.isInteger(claims.expiresAt)
  );
}

export function createSessionToken(
  identity: SessionIdentity,
  secret: string,
  nowMs = Date.now(),
  ttlSeconds = 8 * 60 * 60,
): string {
  const claims: SessionClaims = {
    version: 1,
    subject: identity.subject,
    email: identity.email.trim().toLowerCase(),
    expiresAt: Math.floor(nowMs / 1000) + ttlSeconds,
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${sign(payload, secret).toString("base64url")}`;
}

export function verifySessionToken(
  token: string,
  secret: string,
  nowMs = Date.now(),
): SessionClaims | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, encodedSignature] = parts;
  if (!payload || !encodedSignature) return null;

  try {
    const actual = Buffer.from(encodedSignature, "base64url");
    const expected = sign(payload, secret);
    if (
      actual.length !== expected.length ||
      !timingSafeEqual(actual, expected)
    ) {
      return null;
    }

    const claims: unknown = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    if (!isSessionClaims(claims)) return null;
    if (claims.expiresAt <= Math.floor(nowMs / 1000)) return null;
    if (claims.email !== claims.email.trim().toLowerCase()) return null;
    return claims;
  } catch {
    return null;
  }
}

export function readCookie(
  cookieHeader: string | string[] | undefined,
  name: string,
): string | null {
  if (
    !cookieHeader ||
    Array.isArray(cookieHeader) ||
    cookieHeader.length > 8192
  ) {
    return null;
  }

  const matches = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${name}=`))
    .map((part) => part.slice(name.length + 1));

  return matches.length === 1 && matches[0] ? matches[0] : null;
}

export function sessionCookie(token: string, ttlSeconds: number): string {
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; Max-Age=${ttlSeconds}; HttpOnly; Secure; SameSite=Lax`;
}

export function expiredSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}
