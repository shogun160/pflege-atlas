import { vi } from 'vitest';

// Sub-C3 — Audit-Log: deterministisches Test-Secret für hashIp().
// Überschreibt .env-Wert damit Hash-Output in CI/lokal identisch ist.
process.env.AUDIT_IP_HASH_SECRET = 'test-secret-value-fixed-for-determinism';

// Defense gegen V1.5-Hook-Push aus Integration-Tests.
// `tests/integration/articles.test.ts` lädt via `dotenv/config` die echten
// GITHUB_APP_*-Credentials und ruft `payload.create({status:'published'})`.
// Ohne diese Mocks würde der afterChange-Hook in Articles.ts echtes
// Markdown ins main pushen (Mystery-Trigger 2026-06-20: Commits 838284a
// + 5749a2d). Wir stubben alle GitHub-Module aus — wer in einem Test
// echten Sync braucht, kann lokal `vi.mock` mit eigener Implementierung
// überschreiben.
vi.mock('@/lib/github-app', () => ({
  getOctokit: vi.fn(() => null),
  getAppAuth: vi.fn(() => null),
}));

vi.mock('@/lib/github-article-sync', () => ({
  upsertArticleMarkdown: vi.fn(async () => ({ committed: false, skipped: true })),
  deleteArticleMarkdown: vi.fn(async () => ({ committed: false, skipped: true })),
}));

vi.mock('@/lib/github-pr', () => ({
  createSubmissionPR: vi.fn(async () => ({ number: 0, url: '', headSha: '' })),
  pushToBranch: vi.fn(async () => undefined),
  mergePR: vi.fn(async () => undefined),
  closePR: vi.fn(async () => undefined),
}));

// T7: Mail-Wrapper Mock. Verhindert echte Mail-Sends im Test. Einzelne
// Tests können `vi.mocked(sendMail).mockClear()` und Assertions auf die
// Aufrufe machen.
vi.mock('@/lib/mail', () => ({
  sendMail: vi.fn(async () => undefined),
}));
