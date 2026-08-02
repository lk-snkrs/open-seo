import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

function environment(
  overrides: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  return {
    NODE_ENV: "production",
    PUBLIC_ORIGIN: "https://seo.lksneakers.com.br",
    CORE_ORIGIN: "http://open-seo.railway.internal:3001",
    SUPABASE_URL: "https://lk.supabase.co",
    SUPABASE_ANON_KEY: "anon-key",
    OPEN_SEO_SESSION_SECRET: "s".repeat(48),
    OPEN_SEO_MCP_TOKEN: "m".repeat(48),
    OPEN_SEO_ALLOWED_EMAILS: "SEO@LKSNEAKERS.COM.BR; vendas@lksneakers.com.br",
    ...overrides,
  };
}

describe("gateway configuration", () => {
  it("normalizes the allowlist and accepts only a private production core", () => {
    const config = loadConfig(environment());

    expect(config.allowedEmails).toEqual(
      new Set(["seo@lksneakers.com.br", "vendas@lksneakers.com.br"]),
    );
    expect(config.coreOrigin).toBe("http://open-seo.railway.internal:3001");
  });

  it("rejects a public core origin in production", () => {
    expect(() =>
      loadConfig(environment({ CORE_ORIGIN: "https://open-seo.example.com" })),
    ).toThrow("Railway private hostname");
  });

  it("rejects weak machine and session secrets", () => {
    expect(() =>
      loadConfig(environment({ OPEN_SEO_MCP_TOKEN: "weak" })),
    ).toThrow("at least 32 characters");
    expect(() =>
      loadConfig(environment({ OPEN_SEO_SESSION_SECRET: "weak" })),
    ).toThrow("at least 32 characters");
  });
});
