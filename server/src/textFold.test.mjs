import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixGershayim, foldForSearch } from './store.js';

test('MOT double apostrophe shows as a gershayim quote', () => {
  assert.equal(fixGershayim("בי''ס בר לב/בן יהודה"), 'בי"ס בר לב/בן יהודה');
  assert.equal(fixGershayim("ז'בוטינסקי"), "ז'בוטינסקי");
  assert.equal(fixGershayim(''), '');
});

test('search key ignores how the quote was typed', () => {
  const key = foldForSearch('בי"ס');
  for (const typed of ['בי"ס', 'בי״ס', "בי''ס", 'ביס']) assert.equal(foldForSearch(typed), key);
  assert.equal(foldForSearch('ז׳בוטינסקי'), foldForSearch("ז'בוטינסקי"));
  assert.equal(foldForSearch('Azrieli'), 'azrieli');
});
