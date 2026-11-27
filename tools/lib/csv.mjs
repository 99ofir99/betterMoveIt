/**
 * Streaming CSV reader for GTFS feeds.
 *
 * RFC 4180 quoting, with one deliberate leniency the Israeli MOT feed needs:
 * a double quote only opens a quoted field when it is the FIRST character of
 * the field. MOT does not quote its fields but writes Hebrew abbreviations
 * with a bare ASCII gershayim, e.g. `תל אביב יפו_אוניברסיטת ת"א`. The old
 * reader counted quotes per line, treated those lines as an open quoted field
 * and glued them to the next row — dropping or mis-assigning ~3.4% of trips.
 */
import fs from 'node:fs';
import readline from 'node:readline';

/**
 * Parse one physical line, continuing a quoted field left open by the previous
 * line when `state.open` is true. Returns true when the record is complete.
 * Cells accumulate in `state.cells`; the current cell in `state.cur`.
 */
export function feedLine(line, state) {
  let i = 0;
  if (state.open) state.cur += '\n';
  else {
    state.cells = [];
    state.cur = '';
    state.fieldStart = true;
  }
  while (i < line.length) {
    const c = line[i];
    if (state.open) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          state.cur += '"';
          i += 2;
          continue;
        }
        state.open = false;
      } else state.cur += c;
    } else if (c === '"' && state.fieldStart) {
      state.open = true;
      state.fieldStart = false;
    } else if (c === ',') {
      state.cells.push(state.cur);
      state.cur = '';
      state.fieldStart = true;
      i++;
      continue;
    } else {
      state.cur += c;
      state.fieldStart = false;
    }
    i++;
  }
  if (state.open) return false;
  state.cells.push(state.cur);
  return true;
}

/** Parse a single complete line (no embedded newlines). */
export function splitCsvLine(line) {
  const state = { open: false };
  feedLine(line, state);
  if (state.open) state.cells.push(state.cur); // unterminated quote: keep what we have
  return state.cells;
}

/**
 * Stream rows of `file` as objects keyed by header. Strips a leading BOM.
 * `onRow(row, header, rawRecord)`; resolves with { header, lineNo }.
 * rawRecord is the record's original text (physical lines joined by \n).
 */
export function readCsv(file, onRow, onHeader) {
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(file, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    const state = { open: false };
    let header = null;
    let lineNo = 0;
    let raw = '';
    rl.on('line', (line) => {
      if (lineNo++ === 0) line = line.replace(/^\uFEFF/, '');
      raw = state.open ? `${raw}\n${line}` : line;
      if (!feedLine(line, state)) return;
      const cells = state.cells;
      if (!header) {
        header = cells;
        onHeader?.(header);
        return;
      }
      if (cells.length === 1 && cells[0] === '') return;
      const row = {};
      for (let i = 0; i < header.length; i++) row[header[i]] = cells[i] ?? '';
      onRow(row, header, raw);
    });
    rl.on('close', () => resolve({ header, lineNo }));
    rl.on('error', reject);
    stream.on('error', reject);
  });
}
