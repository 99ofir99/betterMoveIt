import { describe, expect, it } from 'vitest';
import { previewLegs } from './previewLegs';
import type { Leg } from '../types';

const walk = (sec: number) => ({ mode: 'walk', durationSec: sec }) as unknown as Leg;
const bus = { mode: 'transit', durationSec: 600 } as unknown as Leg;

describe('previewLegs', () => {
  it('drops walks of about a minute', () => {
    expect(previewLegs([walk(60), bus, walk(89), bus, walk(300)])).toEqual([bus, bus, walk(300)]);
  });
  it('keeps a walk of 2 minutes', () => {
    expect(previewLegs([walk(120), bus])).toEqual([walk(120), bus]);
  });
  it('never returns an empty list', () => {
    expect(previewLegs([walk(30)])).toEqual([walk(30)]);
  });
});
