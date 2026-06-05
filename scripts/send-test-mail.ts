import 'dotenv/config';

export function parseRecipient(argv: string[], env: Record<string, string | undefined>): string {
  const candidate = argv[2] ?? env.TEST_MAIL_TO;
  if (!candidate) {
    throw new Error(
      'No recipient provided. Usage: pnpm tsx scripts/send-test-mail.ts <recipient@example.com> ' +
        'or set TEST_MAIL_TO env var.',
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate)) {
    throw new Error(`Recipient "${candidate}" is not a valid email address.`);
  }
  return candidate;
}

async function main(): Promise<void> {
  const recipient = parseRecipient(process.argv, process.env);

  if (!process.env.RESEND_API_KEY) {
    console.error(
      'RESEND_API_KEY is not set. Without it the Payload adapter falls back to ' +
        'console logging — set the key (and RESEND_FROM_ADDRESS) before running this script.',
    );
    process.exit(1);
  }

  const { getPayload } = await import('payload');
  const configModule = await import('../src/payload.config');
  const payload = await getPayload({ config: configModule.default });

  const result = await payload.sendEmail({
    to: recipient,
    subject: 'PflegeAtlas Mail-Test',
    html: '<p>Wenn du das liest, funktioniert das Mail-Setup.</p>',
  });

  console.log('Sent:', JSON.stringify(result, null, 2));
}

const isCli = import.meta.url === `file://${process.argv[1]}`;
if (isCli) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
