# LK Sneakers production runbook

This fork deploys OpenSEO to Railway behind an authenticated gateway. The only
public application origin is `https://seo.lksneakers.com.br`.

## Services

| Railway service | Config file               | Exposure | Purpose                          |
| --------------- | ------------------------- | -------- | -------------------------------- |
| `open-seo`      | `/railway.core.json`      | private  | OpenSEO core and persistent data |
| `gateway`       | `/railway.gateway.json`   | public   | Supabase Auth boundary and proxy |
| `scheduler`     | `/railway.scheduler.json` | private  | 15-minute scheduled trigger      |

Set each service's Railway config-file path to the matching file above. The core
volume must be mounted at `/app/.wrangler`; do not expose a Railway domain or TCP
proxy for `open-seo` or `scheduler`. Keep all three services in Railway US East
so private core/scheduler traffic does not cross regions.

The core uses `Dockerfile.railway-core`, which compiles Vite with Railway's build
resources. Runtime startup validates configuration, writes only the allowlisted
worker bindings to an ephemeral mode-0600 `dist/server/.dev.vars`, migrates
SQLite and serves the prebuilt bundle. Secrets never enter an image layer or the
persistent volume, and cold starts stay inside the instance memory limit.
When Railway injects `RAILWAY_ENVIRONMENT_ID`, Vite also accepts the platform's
`healthcheck.railway.app` host so the private deployment can pass promotion.

## Environment variables

### Core

- `AUTH_MODE=local_noauth`
- `CLOUDFLARE_INCLUDE_PROCESS_ENV=true` (forwards Railway runtime variables to the embedded Cloudflare worker)
- `ALLOWED_HOST=open-seo.railway.internal`
- `DATAFORSEO_API_KEY`
- `OPENROUTER_API_KEY`
- `OPEN_SEO_CRON_SECRET`
- `BETTER_AUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `OPENSEO_TELEMETRY_DISABLED=1`
- `VITE_SHOW_DEVTOOLS=false`

### Gateway

- `PUBLIC_ORIGIN=https://seo.lksneakers.com.br`
- `CORE_ORIGIN=http://open-seo.railway.internal:3001`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `OPEN_SEO_ALLOWED_EMAILS`
- `OPEN_SEO_SESSION_SECRET`
- `OPEN_SEO_MCP_TOKEN`
- `OPEN_SEO_SESSION_TTL_SECONDS=28800`

### Scheduler

- `CORE_ORIGIN=http://open-seo.railway.internal:3001`
- `OPEN_SEO_CRON_SECRET`

`OPEN_SEO_CRON_SECRET` must be identical on core and scheduler. MCP, cron and
session secrets must always be different. Keep values in Doppler/Railway only;
never add them to this repository or deployment logs.

## Google Search Console

Enable the Search Console API and configure the OAuth web client with this exact
redirect URI:

`https://seo.lksneakers.com.br/api/gsc/oauth/callback`

The gateway session cookie intentionally uses `SameSite=Lax` so the top-level
OAuth callback can retain the authenticated session.

## LK workspace seed

After the first successful core migration, run `pnpm seed:lk-production` inside
the core service. The idempotent seed creates the Brasil/Portuguese project,
the curated 100-keyword set, daily mobile national tracking, weekly desktop São
Paulo tracking, and SAM project memory with the approved reseller taxonomy.

## Verification

1. Confirm `gateway` returns `200` at `/healthz` and redirects anonymous HTML to
   `/login`.
2. Confirm the core private health endpoint reports DataForSEO, GSC and AI as
   configured.
3. Confirm no public Railway domain or TCP proxy exists for `open-seo`.
4. Run the scheduler once and confirm the bridge returns `202` without exposing
   its bearer token.
5. Log in with one allowlisted account and prove a removed/non-allowlisted account
   receives `403`.
6. Run an audit, one manual rank check and one scheduled rank check; redeploy the
   core and confirm the saved state remains.
7. List MCP tools with the dedicated token and execute a read-only project query.

## Backups and rollback

Enable both daily and weekly backup schedules on the core volume. Create a manual
backup before every upstream upgrade. Application rollback uses the previous
Railway deployment; data rollback restores the selected volume backup and then
redeploys. Removing only the `seo` CNAME/TXT records and the LK-HUB item disables
entry without affecting the storefront, email or other LK subdomains.

## Upstream updates

Production starts from `v0.1.3`. Fetch `upstream/main`, merge through a reviewed
branch, run the complete CI suite and create a manual volume backup before
deploying. Preserve the gateway/core boundary and the private scheduler bridge
when resolving upstream conflicts.
