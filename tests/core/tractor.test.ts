import { describe, expect, it } from 'vitest';
import { buyTractor, useTractor } from '../../src/core/tractor';
import { ctx, expectUnchanged, newTestState } from '../../src/core/testutil';
import { CROPS } from '../../src/core/config';
import type { Field } from '../../src/core/types';

function field(x: number, kind: 'ready' | 'growing' | 'empty', y = 0): Field {
  return {
    id: `f${x}_${y}`, x, y, crop: kind === 'empty' ? null : 'wheat',
    growthMs: kind === 'ready' ? CROPS.wheat.growMs : kind === 'growing' ? 1000 : 0, watered: kind === 'ready',
  };
}
function tractorState(fields: Field[]) {
  const s = newTestState({ level: 7, coins: 1000, hasTractor: true });
  s.fields = fields;
  return s;
}

describe('buyTractor', () => {
  it('locked below level 7', () => {
    const s = newTestState({ level: 6, coins: 1000 });
    expectUnchanged(s, () => buyTractor(s, ctx()), 'locked');
  });
  it('buys at level 7 for 500, gives XP, only once', () => {
    const s = newTestState({ level: 7, coins: 600 });
    expect(buyTractor(s, ctx())).toEqual({ ok: true });
    expect(s.coins).toBe(100);
    expect(s.hasTractor).toBe(true);
    expect(s.xp).toBe(5);
    expectUnchanged(s, () => buyTractor(s, ctx()), 'invalid');
  });
  it('no-money', () => {
    const s = newTestState({ level: 7, coins: 100 });
    expectUnchanged(s, () => buyTractor(s, ctx()), 'no-money');
  });
});

describe('useTractor', () => {
  it('row of 4 ready fields: 4 harvests', () => {
    const s = tractorState([0, 1, 2, 3].map((x) => field(x, 'ready')));
    const c = ctx();
    expect(useTractor(s, c, 0, 0)).toEqual({ ok: true, n: 4 });
    expect(s.fields.every((f) => f.crop === null)).toBe(true);
    expect(s.storage.wheat).toBe(4 * CROPS.wheat.yield);
    expect(c.events.filter((e) => e.type === 'gain')).toHaveLength(4);
  });
  it('[ready, growing, empty, ready] -> n = 3 (empty is skipped, does not break the row)', () => {
    const s = tractorState([field(0, 'ready'), field(1, 'growing'), field(2, 'empty'), field(3, 'ready')]);
    expect(useTractor(s, ctx(), 0, 0)).toEqual({ ok: true, n: 3 });
    expect(s.fields[1].watered).toBe(true);
  });
  it('[ready, no field, ready] -> n = 1 (gap tile stops the row)', () => {
    const s = tractorState([field(0, 'ready'), field(2, 'ready')]);
    expect(useTractor(s, ctx(), 0, 0)).toEqual({ ok: true, n: 1 });
    expect(s.fields[1].crop).toBe('wheat');
  });
  it('tap in the middle of a 6-field run: window of 4 extends right first (x=2 -> 2..5)', () => {
    const s = tractorState([0, 1, 2, 3, 4, 5].map((x) => field(x, 'ready')));
    expect(useTractor(s, ctx(), 2, 0)).toEqual({ ok: true, n: 4 });
    expect(s.fields.map((f) => f.crop === null)).toEqual([false, false, true, true, true, true]);
  });
  it('near the right end the window extends left (run 0..5, tap x=4 -> 2..5)', () => {
    const s = tractorState([0, 1, 2, 3, 4, 5].map((x) => field(x, 'ready')));
    expect(useTractor(s, ctx(), 4, 0)).toEqual({ ok: true, n: 4 });
    expect(s.fields.map((f) => f.crop === null)).toEqual([false, false, true, true, true, true]);
  });
  it('tap on the last field of a 4-run works the whole run (x=3 -> 0..3)', () => {
    const s = tractorState([0, 1, 2, 3].map((x) => field(x, 'ready')));
    expect(useTractor(s, ctx(), 3, 0)).toEqual({ ok: true, n: 4 });
  });
  it('the run is limited by gaps on both sides and stays on its row', () => {
    const s = tractorState([field(0, 'ready'), field(2, 'ready'), field(3, 'ready'), field(5, 'ready'), field(2, 'ready', 1)]);
    expect(useTractor(s, ctx(), 3, 0)).toEqual({ ok: true, n: 2 });
    expect(s.fields.map((f) => f.crop === null)).toEqual([false, true, true, false, false]);
  });
  it('tap on a tile without a field: invalid, unchanged', () => {
    const s = tractorState([field(0, 'ready'), field(2, 'ready')]);
    expectUnchanged(s, () => useTractor(s, ctx(), 1, 0), 'invalid');
  });
  it('without tractor: locked, unchanged', () => {
    const s = tractorState([field(0, 'ready')]);
    s.hasTractor = false;
    expectUnchanged(s, () => useTractor(s, ctx(), 0, 0), 'locked');
  });
  it('0 fields acted on: invalid, unchanged', () => {
    const s = tractorState([field(0, 'empty'), field(1, 'growing')]);
    s.fields[1].watered = true;
    expectUnchanged(s, () => useTractor(s, ctx(), 0, 0), 'invalid');
    expectUnchanged(s, () => useTractor(s, ctx(), 0, 5), 'invalid');
  });
});
