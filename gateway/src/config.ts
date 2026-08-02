type RuntimeConfig = {
  publicOrigin: string;
  coreOrigin: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  sessionSecret: string;
  sessionTtlSeconds: number;
  mcpToken: string;
  allowedEmails: Set<string>;
  port: number;
};

type Environment = Record<string, string | undefined>;

function required(env: Environment, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function origin(value: string, name: string): URL {
  const parsed = new URL(value);
  if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error(`${name} must be an origin without path, query or hash`);
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`${name} must use http or https`);
  }
  return parsed;
}

function secret(env: Environment, name: string): string {
  const value = required(env, name);
  if (value.length < 32)
    throw new Error(`${name} must be at least 32 characters`);
  return value;
}

export function loadConfig(env: Environment = process.env): RuntimeConfig {
  const publicUrl = origin(required(env, "PUBLIC_ORIGIN"), "PUBLIC_ORIGIN");
  const coreUrl = origin(required(env, "CORE_ORIGIN"), "CORE_ORIGIN");
  const supabaseUrl = origin(required(env, "SUPABASE_URL"), "SUPABASE_URL");
  const production = env.NODE_ENV === "production";

  if (production && publicUrl.protocol !== "https:") {
    throw new Error("PUBLIC_ORIGIN must use https in production");
  }
  if (production && !coreUrl.hostname.endsWith(".railway.internal")) {
    throw new Error(
      "CORE_ORIGIN must use a Railway private hostname in production",
    );
  }
  if (supabaseUrl.protocol !== "https:") {
    throw new Error("SUPABASE_URL must use https");
  }

  const allowedEmails = new Set(
    required(env, "OPEN_SEO_ALLOWED_EMAILS")
      .split(/[;,\n]/)
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
  if (allowedEmails.size === 0) {
    throw new Error("OPEN_SEO_ALLOWED_EMAILS must contain at least one email");
  }

  const sessionTtlSeconds = Number(env.OPEN_SEO_SESSION_TTL_SECONDS ?? 28_800);
  if (
    !Number.isInteger(sessionTtlSeconds) ||
    sessionTtlSeconds < 900 ||
    sessionTtlSeconds > 43_200
  ) {
    throw new Error(
      "OPEN_SEO_SESSION_TTL_SECONDS must be between 900 and 43200",
    );
  }

  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be a valid TCP port");
  }

  return {
    publicOrigin: publicUrl.origin,
    coreOrigin: coreUrl.origin,
    supabaseUrl: supabaseUrl.origin,
    supabaseAnonKey: required(env, "SUPABASE_ANON_KEY"),
    sessionSecret: secret(env, "OPEN_SEO_SESSION_SECRET"),
    sessionTtlSeconds,
    mcpToken: secret(env, "OPEN_SEO_MCP_TOKEN"),
    allowedEmails,
    port,
  };
}
