import { describe, expect, it } from 'vitest';
import { formatLineLongName } from './lineCategory';

describe('formatLineLongName', () => {
  it('drops numeric direction codes', () => {
    expect(formatLineLongName('אלחזאן/חטין-רהט<->מחסן עירייה-רהט-10')).toBe('רהט ↔ רהט');
  });
  it('drops MOT "-1#" variant codes', () => {
    expect(formatLineLongName('ת. רכבת יבנה מערב-יבנה<->ת. רכבת יבנה מזרח-יבנה-1#')).toBe('יבנה ↔ יבנה');
  });
});
