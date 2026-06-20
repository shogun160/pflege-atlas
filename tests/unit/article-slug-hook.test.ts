import { describe, it, expect } from 'vitest';
import { slugBeforeValidate } from '@/collections/Articles';

describe('Articles.slug beforeValidate hook', () => {
  it('trimmt Trailing-Whitespace im manuell gesetzten Slug', () => {
    const result = slugBeforeValidate({
      data: { title: 'Beliebig' },
      value: 'dekubitus ',
    });
    expect(result).toBe('dekubitus');
  });

  it('trimmt Leading-Whitespace im manuell gesetzten Slug', () => {
    const result = slugBeforeValidate({
      data: { title: 'Beliebig' },
      value: '  dekubitus',
    });
    expect(result).toBe('dekubitus');
  });

  it('normalisiert Großbuchstaben und Umlaute im manuell gesetzten Slug', () => {
    const result = slugBeforeValidate({
      data: { title: 'Beliebig' },
      value: 'Übergabe Gespräch',
    });
    expect(result).toBe('uebergabe-gespraech');
  });

  it('generiert Slug aus Title wenn kein Value gesetzt', () => {
    const result = slugBeforeValidate({
      data: { title: 'Akute Pflegesituation' },
      value: undefined,
    });
    expect(result).toBe('akute-pflegesituation');
  });

  it('gibt Value unverändert zurück, wenn weder Value noch Title gesetzt', () => {
    const result = slugBeforeValidate({ data: {}, value: undefined });
    expect(result).toBeUndefined();
  });

  it('gibt leeren Slug zurück, wenn Value nur Whitespace ist', () => {
    const result = slugBeforeValidate({
      data: { title: 'Beliebig' },
      value: '   ',
    });
    expect(result).toBe('');
  });
});
