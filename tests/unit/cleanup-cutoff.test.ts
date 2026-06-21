import { describe, expect, it } from 'vitest';
import { computeCutoffISO, REJECTED_RETENTION_DAYS } from '@/lib/cleanup-cutoff';

describe('cleanup-cutoff', () => {
  it('exports retention period of 30 days', () => {
    expect(REJECTED_RETENTION_DAYS).toBe(30);
  });

  it('returns ISO 30 days before given now', () => {
    const now = new Date('2026-07-01T03:00:00.000Z');
    const cutoff = computeCutoffISO(now);
    expect(cutoff).toBe('2026-06-01T03:00:00.000Z');
  });

  it('returns ISO for current time when called without arg', () => {
    const before = Date.now();
    const result = computeCutoffISO();
    const expectedMs = before - 30 * 24 * 60 * 60 * 1000;
    const resultMs = new Date(result).getTime();
    expect(resultMs).toBeGreaterThanOrEqual(expectedMs - 100);
    expect(resultMs).toBeLessThanOrEqual(expectedMs + 100);
  });
});
