import httpProxy from "http-proxy";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Socket } from "node:net";
import { loadConfig } from "./config.js";
import { createGatewayServer, isWebSocketRequestAuthorized } from "./server.js";
import { createSupabasePasswordAuthenticator } from "./supabase.js";

class LoginRateLimiter {
  private readonly attempts = new Map<string, number[]>();

  allow(clientAddress: string, now = Date.now()): boolean {
    const windowStart = now - 60_000;
    const recent = (this.attempts.get(clientAddress) ?? []).filter(
      (timestamp) => timestamp >= windowStart,
    );
    if (recent.length >= 8) {
      this.attempts.set(clientAddress, recent);
      return false;
    }
    recent.push(now);
    this.attempts.set(clientAddress, recent);
    return true;
  }
}

const config = loadConfig();
const proxy = httpProxy.createProxyServer({
  target: config.coreOrigin,
  changeOrigin: true,
  ws: true,
  xfwd: true,
});
const publicUrl = new URL(config.publicOrigin);

function prepareForwardedHeaders(request: IncomingMessage): void {
  request.headers["x-forwarded-host"] = publicUrl.host;
  request.headers["x-forwarded-proto"] = publicUrl.protocol.slice(0, -1);
  request.headers["x-forwarded-port"] = publicUrl.port || "443";
}

function proxyHttp(request: IncomingMessage, response: ServerResponse): void {
  prepareForwardedHeaders(request);
  proxy.web(request, response, {}, () => {
    if (!response.headersSent) {
      response.statusCode = 502;
      response.setHeader("Content-Type", "text/plain; charset=utf-8");
      response.setHeader("Cache-Control", "no-store");
      response.end("OpenSEO temporariamente indisponível.");
    } else {
      response.destroy();
    }
  });
}

const limiter = new LoginRateLimiter();
const server = createGatewayServer(config, {
  signIn: createSupabasePasswordAuthenticator({
    supabaseUrl: config.supabaseUrl,
    anonKey: config.supabaseAnonKey,
  }),
  proxyHttp,
  allowLoginAttempt: (clientAddress) => limiter.allow(clientAddress),
});

server.on("upgrade", (request, socket: Socket, head) => {
  if (!isWebSocketRequestAuthorized(request, config)) {
    socket.end("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
    return;
  }
  prepareForwardedHeaders(request);
  proxy.ws(request, socket, head, {}, () => socket.destroy());
});

server.listen(config.port, "0.0.0.0", () => {
  console.log(`LK OpenSEO gateway listening on port ${config.port}`);
});

function shutdown(): void {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
