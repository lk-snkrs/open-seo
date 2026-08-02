import {
  request as httpRequest,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createGatewayServer,
  isWebSocketRequestAuthorized,
  type GatewayConfig,
} from "./server.js";
import { createSessionToken, SESSION_COOKIE_NAME } from "./session.js";

const config: GatewayConfig = {
  publicOrigin: "https://seo.lksneakers.com.br",
  sessionSecret: "s".repeat(48),
  sessionTtlSeconds: 3600,
  mcpToken: "m".repeat(48),
  allowedEmails: new Set(["seo@lksneakers.com.br"]),
};

const servers: Array<ReturnType<typeof createGatewayServer>> = [];

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map(
        (server) =>
          new Promise<void>((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve())),
          ),
      ),
  );
});

async function start(input?: {
  signIn?: (
    email: string,
    password: string,
  ) => Promise<{ id: string; email: string }>;
}) {
  const proxyHttp = vi.fn(
    (_request: IncomingMessage, response: ServerResponse) => {
      response.statusCode = 200;
      response.end("proxied");
    },
  );
  const server = createGatewayServer(config, {
    signIn:
      input?.signIn ??
      (async () => ({ id: "user-1", email: "seo@lksneakers.com.br" })),
    proxyHttp,
    allowLoginAttempt: () => true,
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Gateway test server did not bind to a TCP port");
  }
  return { baseUrl: `http://127.0.0.1:${address.port}`, proxyHttp };
}

function sessionCookie(email = "seo@lksneakers.com.br") {
  const token = createSessionToken(
    { subject: "user-1", email },
    config.sessionSecret,
    Date.now(),
    config.sessionTtlSeconds,
  );
  return `${SESSION_COOKIE_NAME}=${token}`;
}

async function postFormWithoutFetchDefaults(
  baseUrl: string,
  headers: Record<string, string>,
): Promise<number> {
  const target = new URL("/login", baseUrl);
  const body = new URLSearchParams({
    email: "seo@lksneakers.com.br",
    password: "correct horse battery staple",
  }).toString();

  return new Promise<number>((resolve, reject) => {
    const request = httpRequest(
      target,
      {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body).toString(),
        },
      },
      (response) => {
        response.resume();
        response.on("end", () => resolve(response.statusCode ?? 0));
      },
    );
    request.on("error", reject);
    request.end(body);
  });
}

describe("gateway request boundary", () => {
  it("redirects anonymous HTML and rejects anonymous API without forwarding", async () => {
    const { baseUrl, proxyHttp } = await start();

    const html = await fetch(`${baseUrl}/`, {
      headers: { Accept: "text/html" },
      redirect: "manual",
    });
    const api = await fetch(`${baseUrl}/api/projects`, {
      headers: { Accept: "application/json" },
    });

    expect(html.status).toBe(303);
    expect(html.headers.get("location")).toBe("/login");
    expect(api.status).toBe(401);
    expect(proxyHttp).not.toHaveBeenCalled();
  });

  it("forwards a valid allowlisted session and rejects a removed email", async () => {
    const { baseUrl, proxyHttp } = await start();

    const allowed = await fetch(`${baseUrl}/api/projects`, {
      headers: { Cookie: sessionCookie() },
    });
    const removed = await fetch(`${baseUrl}/api/projects`, {
      headers: { Cookie: sessionCookie("former@lksneakers.com.br") },
    });

    expect(allowed.status).toBe(200);
    expect(await allowed.text()).toBe("proxied");
    expect(removed.status).toBe(403);
    expect(proxyHttp).toHaveBeenCalledTimes(1);
  });

  it("authenticates with Supabase, sets a secure cookie and blocks outsiders", async () => {
    const signIn = vi.fn(async (email: string) => ({ id: "user-1", email }));
    const { baseUrl, proxyHttp } = await start({ signIn });

    const allowed = await fetch(`${baseUrl}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: config.publicOrigin,
      },
      body: new URLSearchParams({
        email: "SEO@LKSNEAKERS.COM.BR",
        password: "correct horse battery staple",
      }),
      redirect: "manual",
    });
    const outsider = await fetch(`${baseUrl}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: config.publicOrigin,
      },
      body: new URLSearchParams({
        email: "outsider@example.com",
        password: "correct horse battery staple",
      }),
      redirect: "manual",
    });

    expect(allowed.status).toBe(303);
    expect(allowed.headers.get("set-cookie")).toContain("HttpOnly");
    expect(allowed.headers.get("set-cookie")).toContain("Secure");
    expect(allowed.headers.get("set-cookie")).toContain("SameSite=Lax");
    expect(outsider.status).toBe(403);
    expect(outsider.headers.get("set-cookie")).toBeNull();
    expect(proxyHttp).not.toHaveBeenCalled();
  });

  it("accepts Safari same-origin form posts when Origin is omitted", async () => {
    const signIn = vi.fn(async (email: string) => ({ id: "user-1", email }));
    const { baseUrl } = await start({ signIn });

    const status = await postFormWithoutFetchDefaults(baseUrl, {
      Host: "seo.lksneakers.com.br",
      "Sec-Fetch-Site": "same-origin",
    });

    expect(status).toBe(303);
    expect(signIn).toHaveBeenCalledOnce();
  });

  it("rejects cross-site or wrong-host form posts without Origin", async () => {
    const signIn = vi.fn(async (email: string) => ({ id: "user-1", email }));
    const { baseUrl } = await start({ signIn });

    const crossSiteStatus = await postFormWithoutFetchDefaults(baseUrl, {
      Host: "seo.lksneakers.com.br",
      "Sec-Fetch-Site": "cross-site",
    });
    const wrongHostStatus = await postFormWithoutFetchDefaults(baseUrl, {
      Host: "attacker.example",
      "Sec-Fetch-Site": "same-origin",
    });

    expect(crossSiteStatus).toBe(403);
    expect(wrongHostStatus).toBe(403);
    expect(signIn).not.toHaveBeenCalled();
  });

  it("does not fall back when an explicit Origin is wrong", async () => {
    const signIn = vi.fn(async (email: string) => ({ id: "user-1", email }));
    const { baseUrl } = await start({ signIn });

    const response = await fetch(`${baseUrl}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Host: "seo.lksneakers.com.br",
        Origin: "https://attacker.example",
        "Sec-Fetch-Site": "same-origin",
      },
      body: new URLSearchParams({
        email: "seo@lksneakers.com.br",
        password: "correct horse battery staple",
      }),
    });

    expect(response.status).toBe(403);
    expect(signIn).not.toHaveBeenCalled();
  });

  it("protects MCP with its dedicated bearer token only", async () => {
    const { baseUrl, proxyHttp } = await start();

    const cookieOnly = await fetch(`${baseUrl}/mcp`, {
      headers: { Cookie: sessionCookie() },
    });
    const bearer = await fetch(`${baseUrl}/mcp`, {
      headers: { Authorization: `Bearer ${config.mcpToken}` },
    });

    expect(cookieOnly.status).toBe(401);
    expect(cookieOnly.headers.get("www-authenticate")).toBe("Bearer");
    expect(bearer.status).toBe(200);
    expect(proxyHttp).toHaveBeenCalledTimes(1);
  });

  it("authorizes WebSocket upgrades only with an allowlisted session", () => {
    expect(
      isWebSocketRequestAuthorized(
        { headers: { cookie: sessionCookie() } },
        config,
      ),
    ).toBe(true);
    expect(
      isWebSocketRequestAuthorized(
        { headers: { cookie: sessionCookie("former@lksneakers.com.br") } },
        config,
      ),
    ).toBe(false);
    expect(isWebSocketRequestAuthorized({ headers: {} }, config)).toBe(false);
  });
});
