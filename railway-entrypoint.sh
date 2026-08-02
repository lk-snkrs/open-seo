#!/bin/sh
set -eu

# Fail quickly on missing or inconsistent production configuration.
pnpm exec tsx scripts/selfhost-preflight.ts

# The Cloudflare Vite runtime reads worker bindings from .dev.vars. Railway
# injects secrets only when the container starts, after the immutable bundle
# has been built, so materialize only the required bindings in the ephemeral
# container filesystem (never the persistent volume or image layer).
umask 077
runtime_env_file="/app/dist/server/.dev.vars"
: > "$runtime_env_file"
chmod 600 "$runtime_env_file"
for name in \
  AUTH_MODE \
  DATAFORSEO_API_KEY \
  GOOGLE_CLIENT_ID \
  GOOGLE_CLIENT_SECRET \
  BETTER_AUTH_SECRET \
  OPENROUTER_API_KEY \
  OPENROUTER_MODEL \
  OPEN_SEO_CRON_SECRET \
  OPENSEO_TELEMETRY_DISABLED \
  ALLOWED_HOST; do
  value=$(printenv "$name" 2>/dev/null || true)
  case "$value" in
    *'
'*)
      echo "Invalid multiline runtime value for $name" >&2
      exit 1
      ;;
  esac
  if [ -n "$value" ]; then
    printf '%s=%s\n' "$name" "$value" >> "$runtime_env_file"
  fi
done

# Migrations run against the persistent Railway volume before the server is
# exposed. They are idempotent and remain the canonical OpenSEO migration path.
pnpm run db:migrate:local

exec pnpm exec vite preview --host 0.0.0.0 --port "${PORT:-3001}"
