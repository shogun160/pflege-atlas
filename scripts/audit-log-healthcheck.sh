#!/usr/bin/env bash
# Sub-C3 Audit-Log post-deploy / periodic health-check.
#
# Verifies:
#   1) AUDIT_IP_HASH_SECRET wirkt: jüngste login.*-Events haben ipHash
#   2) Cleanup-Cron-Heartbeat: letzter audit.cleanup.run < 25h alt
#   3) Event-Summary letzte 24h
#
# Usage gegen Dev-DB (default aus .env):
#   bash scripts/audit-log-healthcheck.sh
#
# Usage gegen Production:
#   DATABASE_URI="postgres://...neon-prod..." bash scripts/audit-log-healthcheck.sh
#
# Exit-Code: 0 = alle Checks bestanden, 1 = mindestens einer fehlgeschlagen.
# Geeignet für cron-job.org / UptimeRobot oder lokal nach jedem Production-Deploy.

set -euo pipefail
cd "$(dirname "$0")/.."
exec npx tsx scripts/audit-log-healthcheck.ts "$@"
