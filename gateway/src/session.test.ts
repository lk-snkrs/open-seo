import { describe, expect, it } from "vitest";
import { createSessionToken, verifySessionToken } from "./session.js";

const secret = "s".repeat(48);
const now = new Date("2026-08-02T12:00:00.000Z").getTime();

describe("gateway sessions", () => {
  it("round-trips a normalized authorized identity", () => {
    const token = createSessionToken(
      { subject: "user-1", email: "SEO@LKSNEAKERS.COM.BR" },
      secret,
      now,
      3600,
    );

    expect(verifySessionToken(token, secret, now + 1000)).toEqual({
      version: 1,
      subject: "user-1",
      email: "seo@lksneakers.com.br",
      expiresAt: Math.floor(now / 1000) + 3600,
    });
  });

  it("rejects tampered, expired and wrong-secret tokens", () => {
    const token = createSessionToken(
      { subject: "user-1", email: "seo@lksneakers.com.br" },
      secret,
      now,
      60,
    );

    expect(verifySessionToken(`${token}x`, secret, now)).toBeNull();
    expect(verifySessionToken(token, "x".repeat(48), now)).toBeNull();
    expect(verifySessionToken(token, secret, now + 61_000)).toBeNull();
  });
});
