import { describe, it, expect } from 'vitest';
import { slugify } from '@/lib/slugify';

describe('slugify', () => {
  it('macht einfache Titel kleingeschrieben', () => {
    expect(slugify('Dekubitus')).toBe('dekubitus');
  });

  it('ersetzt Leerzeichen durch Bindestriche', () => {
    expect(slugify('Akute Pflegesituation')).toBe('akute-pflegesituation');
  });

  it('behandelt deutsche Umlaute', () => {
    expect(slugify('Übergabegespräch')).toBe('uebergabegespraech');
    expect(slugify('Ärztliche Anordnung')).toBe('aerztliche-anordnung');
    expect(slugify('Öffentlich')).toBe('oeffentlich');
    expect(slugify('Straße')).toBe('strasse');
  });

  it('entfernt Sonderzeichen', () => {
    expect(slugify('Demenz & Aggression')).toBe('demenz-aggression');
    expect(slugify('SIS / AEDL')).toBe('sis-aedl');
  });

  it('kollabiert mehrfache Bindestriche', () => {
    expect(slugify('Foo  —  Bar')).toBe('foo-bar');
  });

  it('trimmt führende und trailing Bindestriche', () => {
    expect(slugify('  -Dekubitus-  ')).toBe('dekubitus');
  });

  it('wirft bei leerer Eingabe nicht, gibt leeren String', () => {
    expect(slugify('')).toBe('');
    expect(slugify('   ')).toBe('');
  });
});
