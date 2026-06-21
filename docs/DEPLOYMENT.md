# PflegeAtlas Deployment Runbook (V1.7+)

Diese Anleitung beschreibt den Phase-1-Deployment-Pfad (Vercel Hobby + Neon Free + Cloudflare R2) und skizziert die spätere Phase-2-Migration zu Hetzner+Coolify.

---

## Phase 1: Vercel Hobby + Neon Free + Cloudflare R2

### Voraussetzungen
- Pre-Tasks P0-P5 ausgeführt (siehe `docs/superpowers/plans/2026-06-21-pflegeatlas-deployment-dsgvo-v1-7.md`)
- Credentials in 1Password-Eintrag „PflegeAtlas V1.7 Deployment"
- main-Branch enthält den V1.7-Code (PR gemerged)

### Schritt 1 — Environment-Variablen in Vercel setzen

Im Vercel-Dashboard → Project → Settings → Environment Variables die folgenden Werte für „Production" eintragen:

| Variable | Wert |
|---|---|
| `DATABASE_URI` | Neon Connection-String aus P4 |
| `PAYLOAD_SECRET` | `openssl rand -hex 32` |
| `NEXT_PUBLIC_SITE_URL` | `https://pflegeatlas.org` |
| `RESEND_API_KEY` | aus 1Password V1.3a |
| `RESEND_FROM_ADDRESS` | `noreply@pflegeatlas.org` |
| `RESEND_FROM_NAME` | `PflegeAtlas` |
| `TURNSTILE_SITE_KEY` | aus 1Password V1.3b |
| `TURNSTILE_SECRET_KEY` | aus 1Password V1.3b |
| `GITHUB_APP_ID` | aus 1Password V1.5 |
| `GITHUB_APP_INSTALLATION_ID` | aus 1Password V1.5 |
| `GITHUB_APP_PRIVATE_KEY` | Base64, aus 1Password V1.5 |
| `R2_ACCESS_KEY_ID` | aus P2 |
| `R2_SECRET_ACCESS_KEY` | aus P2 |
| `R2_BUCKET` | `pflegeatlas-media` |
| `R2_ENDPOINT` | `https://<account-id>.r2.cloudflarestorage.com` |
| `CRON_SECRET` | `openssl rand -hex 32` |
| `NEXT_PUBLIC_CF_ANALYTICS_TOKEN` | aus P5 |

### Schritt 2 — Erstes Deployment auf Vercel-Subdomain

- Vercel-Dashboard → Deployments → Redeploy oder push auf main triggert auto-deploy
- Erstes Deployment dauert ~2-4 min (Install + Build + Migrate)
- Verify Logs: Migration-Output zeigt alle bekannten Migrations als „[done]" markiert
- Verify URL: `https://<project>.vercel.app` lädt Homepage

### Schritt 3 — Smoke-Test auf Vercel-Subdomain

Folge der Checkliste in `docs/V1.7-DEPLOYMENT-SMOKE.md`.

### Schritt 4 — DNS Cutover (P6)

- Cloudflare-Dashboard → DNS → pflegeatlas.org
- CNAME-Record `pflegeatlas.org` → `cname.vercel-dns.com`
- CNAME-Record `www` → `cname.vercel-dns.com`
- TTL: Auto (1 min Default)
- Proxy-Status: DNS only (graue Wolke) — Vercel handelt SSL+CDN selbst
- Warten ~1-2 min für TTL-Propagation
- Verify: `dig pflegeatlas.org` zeigt Vercel-Edge-IPs

### Schritt 5 — Production-Smoke

- `https://pflegeatlas.org` → lädt
- HTTPS-Zertifikat (auto via Vercel) → Browser zeigt grünes Schloss
- `/impressum` + `/datenschutz` → 200 OK
- Login + Submission + Cron manuell triggern (siehe Smoke-Checkliste)

### Rollback

Falls etwas schiefgeht:
- Vercel-Dashboard → Deployments → vorigen Deployment → „Promote to Production"
- DNS bleibt unverändert
- Bei DB-Schema-Problem: Neon Free hat 7-Tage Point-in-Time-Recovery; im Neon-Dashboard wiederherstellen

---

## Phase 2: Hetzner+Coolify-Migration (späterer Sub-Plan)

Wird ausgelöst durch eines der folgenden Ereignisse:
- Neon Free DB > 0.5 GB (forced)
- Vercel Bandwidth > 100 GB/Monat (forced)
- Verein/UG-Gründung (Verantwortlichkeit ändert sich)
- Wunsch nach „deutsches Rechenzentrum" in Datenschutzerklärung

### Vorbereitende Schritte (vor Migrations-Tag)

- Hetzner-Account anlegen, Cloud-Projekt erstellen
- CX22-VPS bestellen (Nürnberg oder Falkenstein), Ubuntu 24.04 LTS
- SSH-Key hinterlegen, UFW konfigurieren, Coolify installieren (`curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash`)
- In Coolify: GitHub-Repo verbinden, automatisches Deploy auf push aktivieren
- Coolify-managed Postgres-Service anlegen (Version 16)
- ENV-Vars aus Vercel-Dashboard ins Coolify-Dashboard kopieren

### Migrations-Tag

1. `pg_dump` aus Neon: `pg_dump $NEON_URI > pflegeatlas-backup.sql`
2. `pg_restore` in Coolify-Postgres: `psql $COOLIFY_DB_URI < pflegeatlas-backup.sql`
3. Erstes Coolify-Deploy auf einer temporären Subdomain (z.B. `coolify-staging.pflegeatlas.org`)
4. Smoke-Test auf der Subdomain
5. DNS-Cutover Cloudflare A-Record `pflegeatlas.org` → Hetzner-IP
6. Smoke-Test Production-Domain
7. Vercel-Project pausieren (oder löschen), Neon-Project löschen
8. Datenschutzerklärung aktualisieren: Vercel + Neon raus, Hetzner als Anbieter rein
9. AVV-Sammlung aktualisieren (Hetzner-DPA hinzufügen, Vercel+Neon archivieren)

Geschätzte Dauer Phase-2-Migration: 4-6 Stunden in einer Session.

---

## Notfall-Kontakte

- **Vercel-Support:** https://vercel.com/help (Hobby keine SLA)
- **Neon-Support:** https://neon.tech/docs/introduction/support (Free keine SLA)
- **Cloudflare-Support:** Dashboard → Help (Free-Tier-Tickets)
- **Resend-Support:** https://resend.com/help
- **GitHub-App-Support:** https://github.com/settings/apps/pflegeatlas-bot

## Häufige Fehler

### „Function timed out"
- Vercel-Hobby Function-Timeout = 10s. Bei Build-Step-Hang: Migration-Hänger (z.B. interaktiver Prompt). Lösung: NODE_ENV=production für Migration setzen, oder Migration lokal applien und manuell `payload_migrations`-Row eintragen.

### „R2 PutObject 403 Forbidden"
- API-Token-Permissions checken (Object Read & Write, bucket-spezifisch)
- Endpoint-URL: muss `https://<account-id>.r2.cloudflarestorage.com` sein, nicht der Bucket-URL

### „Neon connection refused"
- Connection-String muss `?sslmode=require` enthalten
- Cold-Start: erste Request nach Idle 3-5s langsam — kein Bug

### „Cron-Job not running"
- Vercel Hobby unterstützt max 2 Cron-Jobs, 1x/Tag — daily.schedule muss passen
- Logs in Vercel-Dashboard → Project → Functions → Cron → Logs
- Manuell triggern: `curl -H "Authorization: Bearer $CRON_SECRET" https://pflegeatlas.org/api/cron/cleanup-submissions`
