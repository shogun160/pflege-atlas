import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Datenschutz from '@/app/(frontend)/datenschutz/page';

describe('Datenschutzerklärung', () => {
  it('shows main heading', () => {
    render(<Datenschutz />);
    expect(screen.getByRole('heading', { name: /Datenschutzerklärung/i, level: 1 })).toBeInTheDocument();
  });

  it('lists all five auftragsverarbeiter providers', () => {
    render(<Datenschutz />);
    expect(screen.getAllByText(/Vercel/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Neon/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Cloudflare/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Resend/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/GitHub/i).length).toBeGreaterThan(0);
  });

  it('explains EU-US Data Privacy Framework for US providers', () => {
    render(<Datenschutz />);
    expect(
      screen.getAllByText(/EU-US Data Privacy Framework|Data Privacy Framework|DPF/i).length,
    ).toBeGreaterThan(0);
  });

  it('shows V1.5 GitHub-PR-Mirror-section with irreversibility-notice', () => {
    render(<Datenschutz />);
    expect(
      screen.getAllByText(/öffentlichen Pull-Request|öffentlicher GitHub.*PR|GitHub-Pull-Request/i)
        .length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/unwiderruflich|nicht löschbar|nicht widerrufen/i).length,
    ).toBeGreaterThan(0);
  });

  it('shows V1.6 editorial workflow PII-disclosure', () => {
    render(<Datenschutz />);
    expect(screen.getAllByText(/Redakteur|Editor|Reviewer/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/E-Mail.*sichtbar|sehen.*E-Mail|Kontakt-E-Mail/i).length)
      .toBeGreaterThan(0);
  });

  it('lists soft-delete and CC-BY-SA-rationale', () => {
    render(<Datenschutz />);
    expect(screen.getAllByText(/anonymisier/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/CC BY-SA|Creative Commons/i).length).toBeGreaterThan(0);
  });

  it('shows retention table with key values', () => {
    render(<Datenschutz />);
    expect(screen.getAllByText(/30 Tage/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/abgelehnt|rejected/i).length).toBeGreaterThan(0);
  });

  it('shows joint-controller-hint (Art. 26)', () => {
    render(<Datenschutz />);
    expect(
      screen.getAllByText(/gemeinsam Verantwortliche|Joint.Controller|Art\.\s?26/i).length,
    ).toBeGreaterThan(0);
  });

  it('shows betroffenenrechte with datenschutz@-mail', () => {
    render(<Datenschutz />);
    expect(screen.getAllByText(/Auskunft|Berichtigung|Löschung/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /datenschutz@pflegeatlas\.org/i })).toBeInTheDocument();
  });

  it('mentions Cloudflare Web Analytics as cookieless', () => {
    render(<Datenschutz />);
    expect(screen.getAllByText(/Cloudflare Web Analytics/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/cookielos|ohne Cookies|cookieless/i).length).toBeGreaterThan(0);
  });
});
