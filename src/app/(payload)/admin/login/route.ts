import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Redirects Payload's default /admin/login to the V1.6 frontend /login page.
// Spezifischere Route schlägt Payloads catch-all `[[...segments]]` in
// `(payload)/admin/`. The frontend /login picks up `?next=/admin` and sends
// admins/editors/reviewers back to the admin UI after auth.
export function GET(req: NextRequest) {
  const url = new URL('/login', req.url);
  url.searchParams.set('next', '/admin');
  return NextResponse.redirect(url, 307);
}

export const dynamic = 'force-dynamic';
