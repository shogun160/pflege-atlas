import { getPayload } from 'payload';
import config from '@/payload.config';

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendMail(message: MailMessage): Promise<void> {
  const payload = await getPayload({ config });
  await payload.sendEmail({
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });
}
