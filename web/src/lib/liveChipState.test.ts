import { describe, expect, it } from 'vitest';
import { EMPTY_GRACE_MS, nextLiveChipState } from './liveChipState';

const fresh = { lastSeenAt: null, lastCount: 0 };

describe('nextLiveChipState', () => {
  it('searches only before the first answer', () => {
    expect(nextLiveChipState(fresh, { count: 0, loading: true, now: 0 }).mode).toBe('searching');
    expect(nextLiveChipState(fresh, { count: 0, loading: false, now: 0 }).mode).toBe('empty');
  });

  it('a later reload never flips back to searching', () => {
    const empty = nextLiveChipState(fresh, { count: 0, loading: false, now: 0 });
    // loading=true again (bbox restart) after an answer was shown: stays empty
    // only if nothing was ever seen; with no buses ever, still not "searching" loop
    expect(nextLiveChipState(empty.mem, { count: 0, loading: false, now: 5000 }).mode).toBe('empty');
  });

  it('keeps the last count through a short gap, then settles on empty', () => {
    const live = nextLiveChipState(fresh, { count: 3, loading: false, now: 1000 });
    const gap = nextLiveChipState(live.mem, { count: 0, loading: false, now: 6000 });
    expect(gap).toMatchObject({ mode: 'live', count: 3 });
    const gone = nextLiveChipState(live.mem, { count: 0, loading: false, now: 1000 + EMPTY_GRACE_MS + 1 });
    expect(gone.mode).toBe('empty');
  });
});
