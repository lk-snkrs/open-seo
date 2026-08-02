import process from "node:process";

const path = "/api/internal/scheduled-rank-checks";
const coreOrigin = process.env.CORE_ORIGIN?.trim();
const cronSecret = process.env.OPEN_SEO_CRON_SECRET?.trim();

if (!coreOrigin || !cronSecret || cronSecret.length < 32) {
  console.error("Scheduler configuration is incomplete");
  process.exit(1);
}

const coreUrl = new URL(coreOrigin);
if (!coreUrl.hostname.endsWith(".railway.internal")) {
  console.error("Scheduler core must use Railway private networking");
  process.exit(1);
}

try {
  const response = await fetch(new URL(path, coreUrl), {
    method: "POST",
    headers: { Authorization: `Bearer ${cronSecret}` },
    signal: AbortSignal.timeout(240_000),
  });
  if (!response.ok) {
    console.error(
      `Scheduled rank-check bridge returned HTTP ${response.status}`,
    );
    process.exit(1);
  }
  console.log("Scheduled rank-check bridge accepted the run");
} catch {
  console.error("Scheduled rank-check bridge is unavailable");
  process.exit(1);
}
