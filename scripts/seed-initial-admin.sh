#!/usr/bin/env bash
#
# Interaktiver Wrapper für scripts/seed-initial-admin.ts
# Fragt nach DB-URI, E-Mail, Display-Name und Password (versteckt),
# setzt sie als ENV-Vars und triggert tsx-Lauf des TS-Skripts.
#
# Verwendung: bash scripts/seed-initial-admin.sh

set -euo pipefail

echo "=== Initial-Admin-Seed für PflegeAtlas ==="
echo

read -p "DATABASE_URI (Neon-Prod-Connection-String): " DATABASE_URI
read -p "Admin-E-Mail [oliver.wosnitza@gmail.com]: " EMAIL
EMAIL=${EMAIL:-oliver.wosnitza@gmail.com}
read -p "Display-Name [Oliver Wosnitza]: " NAME
NAME=${NAME:-Oliver Wosnitza}
read -s -p "Admin-Password (min 8 Zeichen, versteckt): " PASSWORD
echo
read -s -p "Password wiederholen: " PASSWORD2
echo

if [[ "$PASSWORD" != "$PASSWORD2" ]]; then
  echo "Passwords stimmen nicht überein. Abbruch."
  exit 1
fi

if [[ ${#PASSWORD} -lt 8 ]]; then
  echo "Password muss mindestens 8 Zeichen haben. Abbruch."
  exit 1
fi

export DATABASE_URI
export SEED_ADMIN_EMAIL="$EMAIL"
export SEED_ADMIN_PASSWORD="$PASSWORD"
export SEED_ADMIN_NAME="$NAME"

echo
echo "Verbinde mit DB und lege Admin-Account an …"
pnpm tsx scripts/seed-initial-admin.ts
