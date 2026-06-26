import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Sub-C3 — Audit-Log: deterministisches Test-Secret für hashIp().
// Überschreibt .env-Wert damit Hash-Output in CI/lokal identisch ist.
process.env.AUDIT_IP_HASH_SECRET = 'test-secret-value-fixed-for-determinism';

afterEach(() => {
  cleanup();
});
