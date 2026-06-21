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
