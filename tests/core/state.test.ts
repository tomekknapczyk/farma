import { describe, it, expect } from 'vitest';
import { createInitialState, newId } from '../../src/core/state';
import { xpToNext } from '../../src/core/config';
import { newTestState, ctx } from '../../src/core/testutil';

describe('createInitialState', () => {
  const s = createInitialState(1);
  it('has start values', () => {
    expect(s.coins).toBe(50);
    expect(s.level).toBe(1);
    expect(s.timeMs).toBe(0);
    expect(s.lastSeason).toBe('spring');
    expect(s.weather).toEqual({ kind: 'sun', untilMs: 180000 });
    expect(s.storage.wheat).toBe(0);
    expect(s.freeSeeds.pumpkin).toBe(0);
    expect(s.storage.milk).toBe(0);
  });
  it('has only parcel 5 unlocked', () => {
    expect(s.parcels).toHaveLength(16);
    expect(s.parcels[5]).toBe(true);
    expect(s.parcels.filter(Boolean)).toHaveLength(1);
  });
  it('has 4 empty fields on start tiles', () => {
    expect(s.fields.map(f => [f.x, f.y])).toEqual([[5, 5], [6, 5], [5, 6], [6, 6]]);
    expect(s.fields.every(f => f.crop === null && !f.watered)).toBe(true);
  });
});

describe('newId', () => {
  it('increments nextId', () => {
    const s = createInitialState(1);
    const a = newId(s, 'f');
    const b = newId(s, 'b');
    expect(a).not.toBe(b);
    expect(b.startsWith('b')).toBe(true);
  });
});

describe('xpToNext', () => {
  it('matches table', () => {
    expect(xpToNext(1)).toBe(150);
    expect(xpToNext(2)).toBe(522);
    expect(xpToNext(9)).toBe(7829);
  });
});

describe('testutil', () => {
  it('ctx cycles seq', () => {
    const c = ctx([0.1, 0.2]);
    expect([c.rng.next(), c.rng.next(), c.rng.next()]).toEqual([0.1, 0.2, 0.1]);
    expect(ctx().rng.next()).toBe(0.99);
  });
  it('newTestState patches', () => {
    expect(newTestState({ coins: 7 }).coins).toBe(7);
  });
});
