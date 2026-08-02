#!/bin/sh
set -eu

# Fail quickly on missing or inconsistent production configuration.
pnpm exec tsx scripts/selfhost-preflight.ts

# Migrations run against the persistent Railway volume before the server is
# exposed. They are idempotent and remain the canonical OpenSEO migration path.
pnpm run db:migrate:local

exec pnpm exec vite preview --host 0.0.0.0 --port "${PORT:-3001}"
