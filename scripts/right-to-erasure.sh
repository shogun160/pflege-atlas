#!/usr/bin/env bash
#
# Interaktiver Wrapper für scripts/right-to-erasure.ts
# Führt den Anonymisierungs-Pfad eines Users durch (identisch zu
# deleteOwnAccountAction), auf Admin-Wunsch wenn echte Art.-17-Anfrage
# per Mail kommt. Verlangt explizite "ERASE <email>"-Confirmation.
#
# Verwendung: bash scripts/right-to-erasure.sh user@example.de

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Verwendung: $0 <user-email>"
  exit 1
fi

TARGET_EMAIL="$1"

if [[ -z "${DATABASE_URI:-}" ]]; then
  echo "DATABASE_URI ist nicht gesetzt. Aus .env(.local) laden oder explizit exportieren."
  exit 1
fi

echo "=== Right-to-Erasure für PflegeAtlas ==="
echo "Ziel-User: $TARGET_EMAIL"
echo "DB: $DATABASE_URI"
echo

export TARGET_EMAIL
pnpm tsx scripts/right-to-erasure.ts
