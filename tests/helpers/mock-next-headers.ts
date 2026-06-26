// tests/helpers/mock-next-headers.ts
import { vi } from 'vitest';

/**
 * DRY-Helper für `vi.doMock('next/headers', ...)`. Mockt `cookies()` mit no-op
 * set/delete/get-Stubs (Server-Action-kompatibel) und `headers()` mit dem
 * übergebenen Headers-Objekt (default: leere Headers).
 *
 * In-Scope-Migration: nur Test-Dateien, die der auth-polish-PR ohnehin
 * anfasst. Die übrigen ~22 Aufrufer bleiben für einen mechanischen
 * Follow-up-PR (T5-M1 Restmigration).
 */
export function mockNextHeaders(headers: Headers = new Headers()): void {
  vi.doMock('next/headers', () => ({
    cookies: async () => ({ set: vi.fn(), delete: vi.fn(), get: () => undefined }),
    headers: async () => headers,
  }));
}

export function unmockNextHeaders(): void {
  vi.doUnmock('next/headers');
}
