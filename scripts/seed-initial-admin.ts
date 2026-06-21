/**
 * Bootstrapping-Skript für den Initial-Admin auf einer frischen Production-DB.
 *
 * V1.6 ist invitation-only — ohne ersten Admin kann niemand einladen.
 * Dieses Skript löst das Henne-Ei-Problem für den allerersten Deploy.
 *
 * Idempotent: bei vorhandenem User wird Password + Rolle aktualisiert,
 * bei fehlendem User wird neu angelegt.
 *
 * Erwartet alle Werte aus ENV-Variablen — interaktive Prompts kommen
 * aus dem Bash-Wrapper `scripts/seed-initial-admin.sh`:
 *   DATABASE_URI          (required — Neon-Prod-Connection-String)
 *   SEED_ADMIN_EMAIL      (required)
 *   SEED_ADMIN_PASSWORD   (required, min 8 chars)
 *   SEED_ADMIN_NAME       (optional, default "Initial Admin")
 *
 * Direkter Aufruf möglich, aber dann ENV-Vars vorher exportieren.
 * Empfohlen: `bash scripts/seed-initial-admin.sh` (interaktiv).
 */
import 'dotenv/config'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL
  const password = process.env.SEED_ADMIN_PASSWORD
  const displayName = process.env.SEED_ADMIN_NAME ?? 'Initial Admin'

  if (!email || !password) {
    console.error('Missing SEED_ADMIN_EMAIL or SEED_ADMIN_PASSWORD.')
    process.exit(1)
  }
  if (password.length < 8) {
    console.error('SEED_ADMIN_PASSWORD muss mindestens 8 Zeichen haben.')
    process.exit(1)
  }
  if (!process.env.DATABASE_URI) {
    console.error('DATABASE_URI ist nicht gesetzt.')
    process.exit(1)
  }

  const payload = await getPayload({ config: configPromise })

  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
  })

  if (existing.docs.length > 0) {
    await payload.update({
      collection: 'users',
      id: existing.docs[0].id,
      data: { password, role: 'admin', displayName },
    })
    console.log(`Updated existing user ${email} to admin (id=${existing.docs[0].id}).`)
  } else {
    const created = await payload.create({
      collection: 'users',
      data: { email, password, role: 'admin', displayName },
    })
    console.log(`Created new admin user ${email} (id=${created.id}).`)
  }

  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
