import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { AuthenticatedUser } from "./supabase.js";
import { AuthenticationError } from "./supabase.js";
import { renderLoginPage } from "./login-page.js";
import {
  createSessionToken,
  expiredSessionCookie,
  readCookie,
  SESSION_COOKIE_NAME,
  sessionCookie,
  verifySessionToken,
} from "./session.js";

export type GatewayConfig = {
  publicOrigin: string;
  sessionSecret: string;
  sessionTtlSeconds: number;
  mcpToken: string;
  allowedEmails: Set<string>;
};

type GatewayDependencies = {
  signIn: (email: string, password: string) => Promise<AuthenticatedUser>;
  proxyHttp: (request: IncomingMessage, response: ServerResponse) => void;
  allowLoginAttempt: (clientAddress: string) => boolean;
};

type SessionAccess =
  | { status: "anonymous" }
  | { status: "forbidden" }
  | { status: "allowed"; email: string };

const LOGIN_CSRF_COOKIE_NAME = "__Host-lk_open_seo_csrf";
const LOGIN_CSRF_TTL_SECONDS = 600;

function setSecurityHeaders(response: ServerResponse): void {
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  response.setHeader(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains",
  );
  response.setHeader("X-Request-Id", crypto.randomUUID());
}

function setLoginContentSecurityPolicy(response: ServerResponse): void {
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; style-src 'unsafe-inline'",
  );
}

function send(
  response: ServerResponse,
  status: number,
  body: string,
  contentType = "text/plain; charset=utf-8",
): void {
  response.statusCode = status;
  response.setHeader("Content-Type", contentType);
  response.setHeader("Cache-Control", "no-store");
  response.end(body);
}

function loginCsrfCookie(token: string): string {
  return `${LOGIN_CSRF_COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${LOGIN_CSRF_TTL_SECONDS}`;
}

function expiredLoginCsrfCookie(): string {
  return `${LOGIN_CSRF_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function sendLoginPage(
  response: ServerResponse,
  status: number,
  message?: string,
): void {
  const csrfToken = randomBytes(32).toString("base64url");
  response.setHeader("Set-Cookie", loginCsrfCookie(csrfToken));
  setLoginContentSecurityPolicy(response);
  send(
    response,
    status,
    renderLoginPage(csrfToken, message),
    "text/html; charset=utf-8",
  );
}

function redirect(response: ServerResponse, location: string): void {
  response.statusCode = 303;
  response.setHeader("Location", location);
  response.setHeader("Cache-Control", "no-store");
  response.end();
}

function requestPath(request: IncomingMessage): string {
  try {
    return new URL(request.url ?? "/", "http://gateway.internal").pathname;
  } catch {
    return "/";
  }
}

function sessionAccess(
  request: Pick<IncomingMessage, "headers">,
  config: GatewayConfig,
): SessionAccess {
  const token = readCookie(request.headers.cookie, SESSION_COOKIE_NAME);
  if (!token) return { status: "anonymous" };
  const claims = verifySessionToken(token, config.sessionSecret);
  if (!claims) return { status: "anonymous" };
  if (!config.allowedEmails.has(claims.email)) return { status: "forbidden" };
  return { status: "allowed", email: claims.email };
}

function bearerMatches(header: string | undefined, expected: string): boolean {
  if (!header?.startsWith("Bearer ")) return false;
  const token = header.slice("Bearer ".length);
  const actualDigest = createHash("sha256").update(token).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(actualDigest, expectedDigest);
}

async function readForm(request: IncomingMessage): Promise<URLSearchParams> {
  const contentType = request.headers["content-type"] ?? "";
  if (!contentType.startsWith("application/x-www-form-urlencoded")) {
    throw new Error("unsupported content type");
  }
  const declaredLength = Number(request.headers["content-length"] ?? 0);
  if (declaredLength > 8192) throw new Error("request too large");

  const chunks: Uint8Array[] = [];
  let length = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += buffer.length;
    if (length > 8192) throw new Error("request too large");
    chunks.push(buffer);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
}

function sameOrigin(request: IncomingMessage, config: GatewayConfig): boolean {
  const origin = request.headers.origin;
  if (origin !== undefined) return origin === config.publicOrigin;

  // Safari can omit Origin on a same-origin HTML form submission. Fetch
  // Metadata is browser-controlled, so only use this fallback when the
  // request still targets the configured public host.
  if (request.headers["sec-fetch-site"] !== "same-origin") return false;
  const expectedHost = new URL(config.publicOrigin).host.toLowerCase();
  return request.headers.host?.toLowerCase() === expectedHost;
}

function loginCsrfMatches(
  request: IncomingMessage,
  form: URLSearchParams,
): boolean {
  const cookieToken = readCookie(
    request.headers.cookie,
    LOGIN_CSRF_COOKIE_NAME,
  );
  const formToken = form.get("_csrf");
  if (!cookieToken || !formToken) return false;

  const cookieBuffer = Buffer.from(cookieToken);
  const formBuffer = Buffer.from(formToken);
  return (
    cookieBuffer.length === formBuffer.length &&
    timingSafeEqual(cookieBuffer, formBuffer)
  );
}

function wantsHtml(request: IncomingMessage): boolean {
  return (
    request.method === "GET" &&
    (request.headers.accept ?? "").includes("text/html")
  );
}

export function isWebSocketRequestAuthorized(
  request: Pick<IncomingMessage, "headers">,
  config: GatewayConfig,
): boolean {
  return sessionAccess(request, config).status === "allowed";
}

export function createGatewayServer(
  config: GatewayConfig,
  dependencies: GatewayDependencies,
) {
  return createServer(async (request, response) => {
    setSecurityHeaders(response);
    const path = requestPath(request);

    try {
      if (request.method === "GET" && path === "/healthz") {
        send(
          response,
          200,
          JSON.stringify({ status: "ok" }),
          "application/json; charset=utf-8",
        );
        return;
      }

      if (request.method === "GET" && path === "/login") {
        if (sessionAccess(request, config).status === "allowed") {
          redirect(response, "/");
          return;
        }
        sendLoginPage(response, 200);
        return;
      }

      if (request.method === "POST" && path === "/login") {
        let form: URLSearchParams;
        try {
          form = await readForm(request);
        } catch {
          send(response, 400, "Requisição inválida.");
          return;
        }
        if (!sameOrigin(request, config) && !loginCsrfMatches(request, form)) {
          send(response, 403, "Origem inválida.");
          return;
        }
        const clientAddress = request.socket.remoteAddress ?? "unknown";
        if (!dependencies.allowLoginAttempt(clientAddress)) {
          response.setHeader("Retry-After", "60");
          send(response, 429, "Muitas tentativas. Aguarde um minuto.");
          return;
        }
        const email = (form.get("email") ?? "").trim().toLowerCase();
        const password = form.get("password") ?? "";
        if (
          !email ||
          email.length > 254 ||
          !password ||
          password.length > 1024
        ) {
          sendLoginPage(response, 400, "Preencha e-mail e senha.");
          return;
        }

        let user: AuthenticatedUser;
        try {
          user = await dependencies.signIn(email, password);
        } catch (error) {
          const status =
            error instanceof AuthenticationError ? error.status : 503;
          const message =
            status === 401
              ? "E-mail ou senha inválidos."
              : "Login temporariamente indisponível.";
          sendLoginPage(response, status, message);
          return;
        }

        const normalizedEmail = user.email.trim().toLowerCase();
        if (!config.allowedEmails.has(normalizedEmail)) {
          send(response, 403, "Conta sem acesso ao OpenSEO.");
          return;
        }

        const token = createSessionToken(
          { subject: user.id, email: normalizedEmail },
          config.sessionSecret,
          Date.now(),
          config.sessionTtlSeconds,
        );
        response.setHeader("Set-Cookie", [
          sessionCookie(token, config.sessionTtlSeconds),
          expiredLoginCsrfCookie(),
        ]);
        redirect(response, "/");
        return;
      }

      if (request.method === "POST" && path === "/logout") {
        if (!sameOrigin(request, config)) {
          send(response, 403, "Origem inválida.");
          return;
        }
        response.setHeader("Set-Cookie", expiredSessionCookie());
        redirect(response, "/login");
        return;
      }

      if (path === "/mcp") {
        const authHeader = Array.isArray(request.headers.authorization)
          ? undefined
          : request.headers.authorization;
        if (!bearerMatches(authHeader, config.mcpToken)) {
          response.setHeader("WWW-Authenticate", "Bearer");
          send(response, 401, "Unauthorized");
          return;
        }
        dependencies.proxyHttp(request, response);
        return;
      }

      const access = sessionAccess(request, config);
      if (access.status === "forbidden") {
        response.setHeader("Set-Cookie", expiredSessionCookie());
        send(response, 403, "Conta sem acesso ao OpenSEO.");
        return;
      }
      if (access.status === "anonymous") {
        if (wantsHtml(request)) {
          redirect(response, "/login");
        } else {
          send(response, 401, "Unauthorized");
        }
        return;
      }

      dependencies.proxyHttp(request, response);
    } catch {
      if (!response.headersSent) {
        send(response, 502, "OpenSEO temporariamente indisponível.");
      } else {
        response.destroy();
      }
    }
  });
}
