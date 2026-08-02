import { describe, expect, it, vi } from "vitest";
import { handleScheduledRankChecksRequest } from "./scheduledRankChecksEndpoint";

const cronSecret = "c".repeat(48);

function request(token?: string, method = "POST") {
  return new Request(
    "https://seo.lksneakers.com.br/api/internal/scheduled-rank-checks",
    {
      method,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    },
  );
}

describe("scheduled rank checks endpoint", () => {
  it("rejects missing and invalid credentials without running work", async () => {
    const runScheduled = vi.fn(async () => undefined);

    const missing = await handleScheduledRankChecksRequest({
      request: request(),
      cronSecret,
      runScheduled,
    });
    const invalid = await handleScheduledRankChecksRequest({
      request: request("wrong"),
      cronSecret,
      runScheduled,
    });

    expect(missing.status).toBe(401);
    expect(invalid.status).toBe(401);
    expect(runScheduled).not.toHaveBeenCalled();
  });

  it("runs the canonical scheduler once for a valid token", async () => {
    const runScheduled = vi.fn(async () => undefined);

    const response = await handleScheduledRankChecksRequest({
      request: request(cronSecret),
      cronSecret,
      runScheduled,
    });

    expect(response.status).toBe(202);
    expect(runScheduled).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toEqual({ status: "accepted" });
  });

  it("rejects non-POST requests and fails closed without configuration", async () => {
    const runScheduled = vi.fn(async () => undefined);
    const wrongMethod = await handleScheduledRankChecksRequest({
      request: request(cronSecret, "GET"),
      cronSecret,
      runScheduled,
    });
    const unconfigured = await handleScheduledRankChecksRequest({
      request: request(cronSecret),
      cronSecret: undefined,
      runScheduled,
    });

    expect(wrongMethod.status).toBe(405);
    expect(wrongMethod.headers.get("allow")).toBe("POST");
    expect(unconfigured.status).toBe(503);
    expect(runScheduled).not.toHaveBeenCalled();
  });
});
