/**
 * Right-to-Erasure-Helper für PflegeAtlas (Sub-C2).
 *
 * Führt den Anonymisierungs-Pfad eines Users durch — identisch zu
 * deleteOwnAccountAction (Avatar-Hard-Delete + anonymizeUserPatch).
 *
 * Für echte Art.-17-Anfragen via Mail an datenschutz@. Für Stufe-B/C
 * (Authorship-Entfernung oder vollständiges Hard-Delete) siehe
 * docs/legal/right-to-erasure-runbook.md Section 6.
 *
 * Verwendung: bash scripts/right-to-erasure.sh user@example.de
 */
import 'dotenv/config'
import * as readline from 'node:readline'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import { hardDeleteAvatar } from '@/lib/avatar-cleanup'
import { anonymizeUserPatch } from '@/lib/user-soft-delete'
import { performErasureRunbook } from '@/lib/erasure-runbook'

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}

async function main() {
  const targetEmail = process.env.TARGET_EMAIL
  if (!targetEmail) {
    console.error('TARGET_EMAIL ist nicht gesetzt. Via Bash-Wrapper aufrufen.')
    process.exit(1)
  }

  const payload = await getPayload({ config: configPromise })

  const found = await payload.find({
    collection: 'users',
    where: { email: { equals: targetEmail } },
    limit: 1,
  })
  if (found.docs.length === 0) {
    console.error(`Kein User mit E-Mail "${targetEmail}" gefunden.`)
    process.exit(1)
  }
  const user = found.docs[0] as {
    id: number
    email: string
    displayName?: string
    role?: string
    disabled?: boolean
    avatar?: number | { id: number } | null
  }

  if (user.role === 'admin') {
    console.error('Admin-Accounts können nicht via Script gelöscht werden. Manuell vorgehen.')
    process.exit(1)
  }
  if (user.disabled) {
    console.error(
      `User ${user.email} ist bereits disabled (id=${user.id}). Vermutlich schon anonymisiert.`,
    )
    process.exit(1)
  }

  const submissionsCount = await payload.count({
    collection: 'submissions',
    where: { submittedBy: { equals: user.id } },
  })
  const articlesCount = await payload.count({
    collection: 'articles',
    where: { authors: { equals: user.id } },
  })
  const avatarId =
    typeof user.avatar === 'object' && user.avatar ? user.avatar.id : (user.avatar ?? null)

  console.log('--- Vorschau ---')
  console.log(`User-ID:         ${user.id}`)
  console.log(`E-Mail:          ${user.email}`)
  console.log(`Display-Name:    ${user.displayName ?? '(keiner)'}`)
  console.log(`Rolle:           ${user.role ?? '(keine)'}`)
  console.log(`Avatar-Media-ID: ${avatarId ?? '(keiner)'}`)
  console.log(`Submissions:     ${submissionsCount.totalDocs}`)
  console.log(`Articles:        ${articlesCount.totalDocs}`)
  console.log('---')
  console.log('Nach Bestätigung wird:')
  console.log('  - Avatar-Media + R2-File hart gelöscht (falls vorhanden)')
  console.log(
    '  - User-Record anonymisiert (email → deleted-*, displayName → "Gelöschte:r Beitragende:r")',
  )
  console.log('  - User.disabled → true')
  console.log('Submissions und Article-Authorships bleiben verlinkt (CC-BY-SA Lizenz-Pflicht).')
  console.log('')

  const expected = `ERASE ${user.email}`
  const answer = await prompt(`Type "${expected}" to confirm: `)
  if (answer.trim() !== expected) {
    console.error('Bestätigung stimmt nicht. Abbruch.')
    process.exit(1)
  }

  const avatarResult = await hardDeleteAvatar(payload, avatarId, {
    userId: user.id,
    trigger: 'account-delete',
  })
  const patch = anonymizeUserPatch()
  const updated = await payload.update({
    collection: 'users',
    id: user.id,
    data: patch as never,
  })

  await performErasureRunbook(payload, {
    userId: user.id,
    originalEmail: targetEmail,
    stage: 'anonymize',
  })

  console.log('')
  console.log('--- Audit-Trail (in Mail-Bestätigung kopieren) ---')
  console.log(`Timestamp:         ${new Date().toISOString()}`)
  console.log(`User-ID:           ${user.id}`)
  console.log(`Original-E-Mail:   ${targetEmail}`)
  console.log(`Anonymisierte E-Mail: ${(updated as { email: string }).email}`)
  console.log(`Avatar-Media-ID:   ${avatarId ?? '(keiner)'}`)
  console.log(
    `Avatar-Delete:     ${avatarResult.deleted ? 'OK' : avatarResult.error ? `FAIL (${avatarResult.error})` : 'no-op (kein Avatar)'}`,
  )
  console.log(`Submissions:       ${submissionsCount.totalDocs} (bleiben verlinkt)`)
  console.log(`Articles:          ${articlesCount.totalDocs} (Authorship bleibt)`)
  console.log('---')

  if (avatarResult.error) {
    console.warn(
      '\n⚠️  WARNUNG: Avatar-Hard-Delete fehlgeschlagen — Media-Doc + R2-File ' +
        'könnten als Orphan zurückgeblieben sein. Siehe ' +
        'docs/legal/right-to-erasure-runbook.md Section 6 für manuellen Cleanup.',
    )
  }

  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
