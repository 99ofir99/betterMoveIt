import { describe, expect, it } from 'vitest';
import { applyLocale, t, tn } from './i18n';
import { HE } from './i18n.he';

const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');

describe('i18n', () => {
  it('falls back to English and fills placeholders', () => {
    applyLocale('en');
    expect(t('Walk to {name}', { name: 'Azrieli' })).toBe('Walk to Azrieli');
    expect(tn(2, '1 stop', '{n} stops')).toBe('2 stops');
  });

  it('translates to Hebrew when the locale is he', () => {
    applyLocale('he');
    expect(t('Settings')).toBe('הגדרות');
    expect(t('{n} min', { n: 5 })).toBe('5 דק׳');
    expect(t('Not in the dictionary')).toBe('Not in the dictionary');
    applyLocale('en');
  });

  it('keeps the same placeholders in every Hebrew string', () => {
    for (const [en, he] of Object.entries(HE)) {
      expect(placeholders(he), en).toBe(placeholders(en));
    }
  });
});
