import { resendAdapter } from '@payloadcms/email-resend';

export function buildEmailConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey === 'undefined') {
    return undefined;
  }

  const defaultFromAddress = process.env.RESEND_FROM_ADDRESS;
  if (!defaultFromAddress) {
    throw new Error(
      'RESEND_API_KEY is set but RESEND_FROM_ADDRESS is missing. ' +
        'Set both env vars or unset RESEND_API_KEY to fall back to console logging.',
    );
  }

  return resendAdapter({
    apiKey,
    defaultFromAddress,
    defaultFromName: process.env.RESEND_FROM_NAME || 'PflegeAtlas',
  });
}
