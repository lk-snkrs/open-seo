type ScheduledRankChecksEndpointInput = {
  request: Request;
  cronSecret: string | undefined;
  runScheduled: () => Promise<void>;
};

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
}

async function secureEqual(actual: string, expected: string): Promise<boolean> {
  const [actualDigest, expectedDigest] = await Promise.all([
    digest(actual),
    digest(expected),
  ]);
  let difference = 0;
  for (let index = 0; index < expectedDigest.length; index += 1) {
    difference |= actualDigest[index] ^ expectedDigest[index];
  }
  return difference === 0;
}

function json(status: number, body: Record<string, string>): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function handleScheduledRankChecksRequest(
  input: ScheduledRankChecksEndpointInput,
): Promise<Response> {
  if (input.request.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "POST", "Cache-Control": "no-store" },
    });
  }
  if (!input.cronSecret) {
    return json(503, { error: "scheduler_not_configured" });
  }

  const authorization = input.request.headers.get("Authorization") ?? "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  if (!(await secureEqual(token, input.cronSecret))) {
    return new Response("Unauthorized", {
      status: 401,
      headers: {
        "Cache-Control": "no-store",
        "WWW-Authenticate": "Bearer",
      },
    });
  }

  try {
    await input.runScheduled();
    return json(202, { status: "accepted" });
  } catch (error) {
    console.error("[cron] Scheduled rank-check bridge failed", error);
    return json(500, { error: "scheduler_failed" });
  }
}
