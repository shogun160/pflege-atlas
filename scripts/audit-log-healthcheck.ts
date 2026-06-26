/**
 * Sub-C3 Audit-Log Health-Check.
 *
 * Verifies post-deploy / periodically:
 *   1) AUDIT_IP_HASH_SECRET wirkt — letzte login.*-Events haben ipHash
 *   2) Cleanup-Cron-Heartbeat — letzter audit.cleanup.run < 25h alt
 *   3) Bonus: Event-Übersicht letzte 24h (Sichtprüfung auf Anomalien)
 *
 * Verwendung: siehe scripts/audit-log-healthcheck.sh.
 *
 * Schwelle 25h beim Heartbeat: Vercel-Cron läuft täglich (default 04:00 UTC),
 * 1h Slack puffert gegen Cron-Verschiebung / Timezone-Drift.
 */
import 'dotenv/config'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'

const MAX_HEARTBEAT_AGE_HOURS = 25
const LOGIN_LOOKBACK_DAYS = 7

type AuditDoc = {
  createdAt: string
  eventType: string
  ipHash?: string | null
  metadata?: { deletedCount?: number; retentionDays?: number } | null
}

async function main(): Promise<void> {
  const payload = await getPayload({ config: configPromise })
  let failed = 0

  // --- Check 1: AUDIT_IP_HASH_SECRET wirkt? ---
  console.log('\n--- Check 1: AUDIT_IP_HASH_SECRET wirkt? ---')
  const since = new Date(Date.now() - LOGIN_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const recentLogins = await payload.find({
    collection: 'audit-logs',
    where: {
      and: [
        { eventType: { in: ['login.success', 'login.failure'] } },
        { createdAt: { greater_than: since } },
      ],
    },
    sort: '-createdAt',
    limit: 20,
    depth: 0,
  })
  const loginDocs = recentLogins.docs as unknown as AuditDoc[]

  if (loginDocs.length === 0) {
    console.log(`⚠️  Keine login.*-Events in den letzten ${LOGIN_LOOKBACK_DAYS} Tagen — Check inkonklusiv.`)
    console.log(`    Trigger einen Login auf https://pflegeatlas.org/anmelden, dann erneut ausführen.`)
  } else {
    const withHash = loginDocs.filter((d) => d.ipHash)
    const withoutHash = loginDocs.filter((d) => !d.ipHash)
    console.log(`Gefunden: ${loginDocs.length} login-events`)
    console.log(`  ✓ Mit ipHash:  ${withHash.length}`)
    console.log(`  ✗ Ohne ipHash: ${withoutHash.length}`)
    if (withoutHash.length > 0) {
      console.error(
        `❌ FAIL: ${withoutHash.length} login-events ohne ipHash — ` +
          `AUDIT_IP_HASH_SECRET nicht (richtig) gesetzt, ENV nicht neu deployed, ` +
          `oder Header-Threading kaputt.`,
      )
      console.error(
        `   Erstes betroffenes Event: ${withoutHash[0].createdAt} ${withoutHash[0].eventType}`,
      )
      failed += 1
    } else {
      console.log(`✅ PASS: alle ${loginDocs.length} login-events haben ipHash.`)
    }
  }

  // --- Check 2: Cleanup-Cron-Heartbeat? ---
  console.log('\n--- Check 2: Cleanup-Cron-Heartbeat? ---')
  const heartbeats = await payload.find({
    collection: 'audit-logs',
    where: { eventType: { equals: 'audit.cleanup.run' } },
    sort: '-createdAt',
    limit: 1,
    depth: 0,
  })

  if (heartbeats.docs.length === 0) {
    console.error(
      `❌ FAIL: kein audit.cleanup.run-Event gefunden. ` +
        `Cron läuft nicht oder noch nie gelaufen (1× pro Tag erwartet).`,
    )
    failed += 1
  } else {
    const latest = heartbeats.docs[0] as unknown as AuditDoc
    const ageMs = Date.now() - new Date(latest.createdAt).getTime()
    const ageH = ageMs / (1000 * 60 * 60)
    console.log(`Letzter Heartbeat: ${latest.createdAt} (vor ${ageH.toFixed(1)}h)`)
    console.log(`  deletedCount:  ${latest.metadata?.deletedCount ?? '?'}`)
    console.log(`  retentionDays: ${latest.metadata?.retentionDays ?? '?'}`)
    if (ageH > MAX_HEARTBEAT_AGE_HOURS) {
      console.error(
        `❌ FAIL: Heartbeat ist ${ageH.toFixed(1)}h alt (Schwelle ${MAX_HEARTBEAT_AGE_HOURS}h). ` +
          `Cron blockiert/deaktiviert, CRON_SECRET-Mismatch oder Endpoint-500?`,
      )
      failed += 1
    } else {
      console.log(`✅ PASS: Heartbeat innerhalb der ${MAX_HEARTBEAT_AGE_HOURS}h-Schwelle.`)
    }
  }

  // --- Bonus: Event-Übersicht letzte 24h ---
  console.log('\n--- Bonus: Event-Übersicht letzte 24h ---')
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const recent = await payload.find({
    collection: 'audit-logs',
    where: { createdAt: { greater_than: dayAgo } },
    sort: '-createdAt',
    limit: 1000,
    depth: 0,
  })
  const byType: Record<string, number> = {}
  for (const d of recent.docs as unknown as AuditDoc[]) {
    byType[d.eventType] = (byType[d.eventType] ?? 0) + 1
  }
  const sorted = Object.entries(byType).sort((a, b) => b[1] - a[1])
  if (sorted.length === 0) {
    console.log('  (keine Events in den letzten 24h)')
  } else {
    for (const [type, count] of sorted) {
      console.log(`  ${count.toString().padStart(4)}  ${type}`)
    }
  }

  console.log('')
  if (failed > 0) {
    console.error(`\n❌ ${failed} Check(s) fehlgeschlagen.`)
    process.exit(1)
  }
  console.log(`✅ Alle Checks bestanden.`)
  process.exit(0)
}

main().catch((err) => {
  console.error('Healthcheck-Fehler:', err)
  process.exit(1)
})
