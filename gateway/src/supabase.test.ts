import { describe, expect, it, vi } from "vitest";
import { createSupabasePasswordAuthenticator } from "./supabase.js";

describe("Supabase password authentication", () => {
  it("uses the anon key server-side and returns the normalized user", async () => {
    const fetchImpl = vi.fn(
      async (_input: string | URL | Request, _init?: RequestInit) =>
        Response.json({
          user: { id: "user-1", email: "SEO@LKSNEAKERS.COM.BR" },
        }),
    );
    const signIn = createSupabasePasswordAuthenticator({
      supabaseUrl: "https://lk.supabase.co",
      anonKey: "anon-key",
      fetchImpl,
    });

    await expect(signIn("SEO@LKSNEAKERS.COM.BR", "password")).resolves.toEqual({
      id: "user-1",
      email: "seo@lksneakers.com.br",
    });
    const call = fetchImpl.mock.calls[0];
    expect(call?.[0]).toBe(
      "https://lk.supabase.co/auth/v1/token?grant_type=password",
    );
    expect(call?.[1]?.method).toBe("POST");
    expect(new Headers(call?.[1]?.headers).get("apikey")).toBe("anon-key");
  });

  it("maps bad credentials to 401 and upstream failure to 503", async () => {
    const rejected = createSupabasePasswordAuthenticator({
      supabaseUrl: "https://lk.supabase.co",
      anonKey: "anon-key",
      fetchImpl: vi.fn(async () => new Response(null, { status: 400 })),
    });
    const unavailable = createSupabasePasswordAuthenticator({
      supabaseUrl: "https://lk.supabase.co",
      anonKey: "anon-key",
      fetchImpl: vi.fn(async () => {
        throw new Error("offline");
      }),
    });

    await expect(rejected("seo@lk.com", "wrong")).rejects.toMatchObject({
      status: 401,
    });
    await expect(unavailable("seo@lk.com", "password")).rejects.toMatchObject({
      status: 503,
    });
  });
});
