import type { Payload, Where, CollectionSlug } from 'payload';

export interface ExportShape {
  exportedAt: string;
  user: Record<string, unknown>;
  submissions: Array<Record<string, unknown>>;
  articles: Array<Record<string, unknown>>;
}

export const SENSITIVE_USER_FIELDS = [
  'password',
  // App-defined invite/onboarding token (only admin-hidden, not field-level hidden):
  'setPasswordToken',
  'setPasswordTokenExpiresAt',
  // Payload built-ins. These are usually stripped by Payload itself, but list
  // defensively in case `showHiddenFields` is toggled upstream or a future
  // Payload upgrade changes the default.
  'resetPasswordToken',
  'resetPasswordExpiration',
  'salt',
  'hash',
  'loginAttempts',
  'lockUntil',
  'sessions',
  'apiKey',
  'apiKeyIndex',
] as const;

export const EXPORT_HARD_CAP = 10_000;
export const EXPORT_PAGE_SIZE = 500;

export class ExportTooLargeError extends Error {
  constructor(collection: string, count: number) {
    super(
      `Export aborted: ${collection} reached hard cap (${count} >= ${EXPORT_HARD_CAP})`,
    );
    this.name = 'ExportTooLargeError';
  }
}

export function shapeExport(args: {
  user: Record<string, unknown>;
  submissions: Array<Record<string, unknown>>;
  articles: Array<Record<string, unknown>>;
}): ExportShape {
  const userClean: Record<string, unknown> = { ...args.user };
  for (const field of SENSITIVE_USER_FIELDS) {
    delete userClean[field];
  }
  return {
    exportedAt: new Date().toISOString(),
    user: userClean,
    submissions: args.submissions,
    articles: args.articles,
  };
}

export async function findAllForExport<T>(args: {
  payload: Payload;
  collection: CollectionSlug;
  where: Where;
}): Promise<T[]> {
  const { payload, collection, where } = args;
  const accumulated: T[] = [];
  let page = 1;

  while (true) {
    const res = await payload.find({
      collection,
      where,
      limit: EXPORT_PAGE_SIZE,
      page,
      depth: 0,
    });
    accumulated.push(...(res.docs as T[]));

    if (accumulated.length >= EXPORT_HARD_CAP) {
      throw new ExportTooLargeError(collection, accumulated.length);
    }

    if (!res.hasNextPage) break;
    page += 1;
  }

  return accumulated;
}
