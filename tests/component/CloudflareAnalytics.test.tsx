import { render } from '@testing-library/react';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { CloudflareAnalytics } from '@/components/CloudflareAnalytics';

describe('CloudflareAnalytics', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('renders nothing when NEXT_PUBLIC_CF_ANALYTICS_TOKEN is missing', () => {
    delete process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN;
    process.env.NODE_ENV = 'production';
    const { container } = render(<CloudflareAnalytics />);
    expect(container.querySelector('script')).toBeNull();
  });

  it('renders nothing in non-production environments even with token', () => {
    process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN = 'abc123token';
    process.env.NODE_ENV = 'development';
    const { container } = render(<CloudflareAnalytics />);
    expect(container.querySelector('script')).toBeNull();
  });

  it('renders Cloudflare beacon script when token is set and NODE_ENV is production', () => {
    process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN = 'abc123token';
    process.env.NODE_ENV = 'production';
    const { container } = render(<CloudflareAnalytics />);
    const script = container.querySelector('script');
    expect(script).not.toBeNull();
    expect(script?.getAttribute('src')).toBe(
      'https://static.cloudflareinsights.com/beacon.min.js',
    );
    expect(script?.getAttribute('data-cf-beacon')).toContain('abc123token');
    expect(script?.hasAttribute('defer')).toBe(true);
  });
});
