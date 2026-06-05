import { describe, it, expect } from 'vitest';
import { buildMedicalArticleJsonLd } from '@/lib/schema-org';

describe('buildMedicalArticleJsonLd', () => {
  it('erzeugt valides MedicalArticle JSON-LD', () => {
    const json = buildMedicalArticleJsonLd({
      title: 'Dekubitusprophylaxe',
      slug: 'dekubitusprophylaxe',
      summary: 'Kurzbeschreibung.',
      authors: ['Klaus Müller', 'Jane Doe'],
      datePublished: '2026-01-15',
      dateModified: '2026-04-01',
      siteUrl: 'https://pflegecommons.de',
    });

    expect(json['@context']).toBe('https://schema.org');
    expect(json['@type']).toBe('MedicalWebPage');
    expect(json.headline).toBe('Dekubitusprophylaxe');
    expect(json.url).toBe('https://pflegecommons.de/artikel/dekubitusprophylaxe');
    expect(json.author).toEqual([
      { '@type': 'Person', name: 'Klaus Müller' },
      { '@type': 'Person', name: 'Jane Doe' },
    ]);
    expect(json.datePublished).toBe('2026-01-15');
    expect(json.dateModified).toBe('2026-04-01');
    expect(json.license).toBe('https://creativecommons.org/licenses/by-sa/4.0/');
  });

  it('lässt dateModified weg, wenn nicht gesetzt', () => {
    const json = buildMedicalArticleJsonLd({
      title: 'Demenz',
      slug: 'demenz',
      summary: 's',
      authors: ['A'],
      datePublished: '2026-01-01',
      siteUrl: 'https://x.de',
    });
    expect(json.dateModified).toBeUndefined();
  });
});
