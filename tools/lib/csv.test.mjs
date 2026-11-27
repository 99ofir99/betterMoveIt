// Run: npm run test:tools
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { readCsv, splitCsvLine } from './csv.mjs';

test('bare gershayim inside an unquoted field is a literal character', () => {
  assert.deepEqual(splitCsvLine('17220,968,584752721_271126,תל אביב יפו_אוניברסיטת ת"א,0,165192,2'), [
    '17220', '968', '584752721_271126', 'תל אביב יפו_אוניברסיטת ת"א', '0', '165192', '2',
  ]);
});

test('RFC 4180 quoted fields still work', () => {
  assert.deepEqual(splitCsvLine('a,"b,c","d ""q"" e",'), ['a', 'b,c', 'd "q" e', '']);
});

test('MOT trips.txt rows with ת"א are neither merged nor dropped', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'csv-'));
  const file = path.join(dir, 'trips.txt');
  fs.writeFileSync(
    file,
    '﻿route_id,service_id,trip_id,trip_headsign\n' +
      '17220,968,T1,אוניברסיטת ת"א\n' +
      '17220,968,T2,אוניברסיטת ת"א\n' +
      '17226,10687,T3,בני ברק_מגדלי ב.ס.ר\n' +
      '1,1,T4,"multi\nline"\n'
  );
  const rows = [];
  const raws = [];
  await readCsv(file, (r, _h, raw) => {
    rows.push(r);
    raws.push(raw);
  });
  assert.deepEqual(rows.map((r) => [r.route_id, r.trip_id]), [
    ['17220', 'T1'], ['17220', 'T2'], ['17226', 'T3'], ['1', 'T4'],
  ]);
  assert.equal(rows[3].trip_headsign, 'multi\nline');
  assert.equal(raws[0], '17220,968,T1,אוניברסיטת ת"א');
  assert.equal(raws[3], '1,1,T4,"multi\nline"');
});
