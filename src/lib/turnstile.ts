const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyTurnstileToken(token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(
        'TURNSTILE_SECRET_KEY is not set — bypassing Turnstile verification. ' +
          'Do not deploy without a real key.',
      );
    }
    return true;
  }

  if (!token) {
    return false;
  }

  try {
    const body = new URLSearchParams({ secret, response: token });
    const res = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      body,
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (err) {
    console.error('Turnstile verification failed', err);
    return false;
  }
}
