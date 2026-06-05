const UMLAUT_MAP: Record<string, string> = {
  ä: 'ae',
  ö: 'oe',
  ü: 'ue',
  Ä: 'Ae',
  Ö: 'Oe',
  Ü: 'Ue',
  ß: 'ss',
};

export function slugify(input: string): string {
  if (!input) return '';

  const transliterated = input.replace(/[äöüÄÖÜß]/g, (c) => UMLAUT_MAP[c] ?? c);

  return transliterated
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}
