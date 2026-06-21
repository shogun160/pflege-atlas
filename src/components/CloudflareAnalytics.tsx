/**
 * Cookieless Cloudflare Web Analytics beacon.
 *
 * Renders only in production with a token set. The beacon is loaded via
 * Cloudflare's static CDN; no PII, no cookies, only aggregated metrics
 * (PV, country, device-class). No cookie banner needed (TTDSG § 25(2)
 * Nr. 2 — strictly necessary is N/A here, but cookieless means no consent
 * required).
 */
export function CloudflareAnalytics() {
  const token = process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN;
  if (!token || process.env.NODE_ENV !== 'production') {
    return null;
  }
  return (
    <script
      defer
      src="https://static.cloudflareinsights.com/beacon.min.js"
      data-cf-beacon={JSON.stringify({ token })}
    />
  );
}
