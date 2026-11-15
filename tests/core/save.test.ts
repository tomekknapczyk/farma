import { describe, it, expect, vi } from 'vitest';
import { serialize, deserialize, loadGame, saveGame, exportFileName, SAVE_KEY, CORRUPT_KEY } from '../../src/core/save';
import { createInitialState } from '../../src/core/state';
import type { GameState } from '../../src/core/types';

function fakeStore(init: Record<string, string> = {}) {
  const data = { ...init };
  return {
    data,
    getItem: vi.fn((k: string) => (k in data ? data[k] : null)),
    setItem: vi.fn((k: string, v: string) => { data[k] = v; }),
  };
}

describe('save', () => {
  it('round-trips', () => {
    const s = createInitialState(1);
    s.coins = 123; s.xp = 7;
    expect(deserialize(serialize(s))).toEqual(s);
  });
  it('rejects bad JSON', () => { expect(deserialize('{')).toBeNull(); });
  it('rejects wrong version', () => {
    const s = { ...createInitialState(1), version: 2 };
    expect(deserialize(JSON.stringify(s))).toBeNull();
  });
  it('rejects wrong parcels length', () => {
    const s = { ...createInitialState(1), parcels: [true, false, false] };
    expect(deserialize(JSON.stringify(s))).toBeNull();
  });
  it('rejects negative coins and missing storage keys', () => {
    expect(deserialize(JSON.stringify({ ...createInitialState(1), coins: -1 }))).toBeNull();
    const s = createInitialState(1);
    const bad = { ...s, storage: { wheat: 1 } };
    expect(deserialize(JSON.stringify(bad))).toBeNull();
  });
  it('loadGame with no save returns new state', () => {
    const st = fakeStore();
    expect(loadGame(st, 1).coins).toBe(50);
  });
  it('loadGame with corrupt entry keeps raw text and returns new state', () => {
    const st = fakeStore({ [SAVE_KEY]: '{oops' });
    const s = loadGame(st, 1);
    expect(s.coins).toBe(50);
    expect(st.data[CORRUPT_KEY]).toBe('{oops');
  });
  it('saveGame then loadGame restores', () => {
    const st = fakeStore();
    const s = createInitialState(1); s.coins = 999;
    saveGame(st, s);
    expect(loadGame(st, 1).coins).toBe(999);
  });
  it('bad import does not touch the store', () => {
    const st = fakeStore();
    expect(deserialize('not json')).toBeNull();
    expect(st.setItem).not.toHaveBeenCalled();
  });
  it('exportFileName', () => {
    expect(exportFileName(new Date('2026-11-15'))).toBe('farma-kopia-2026-11-15.json');
  });
});

describe('save with failing store', () => {
  const bad = {
    getItem: () => { throw new Error('denied'); },
    setItem: () => { throw new Error('quota'); },
  };
  it('saveGame returns false and does not throw', () => {
    expect(saveGame(bad, createInitialState(1))).toBe(false);
  });
  it('saveGame returns true on success', () => {
    expect(saveGame(fakeStore(), createInitialState(1))).toBe(true);
  });
  it('loadGame falls back to a fresh state when getItem throws', () => {
    expect(loadGame(bad, 1).coins).toBe(50);
  });
});

/** A valid state with one of everything, so each check below breaks exactly one thing. */
function richState(): GameState {
  const s = createInitialState(1);
  s.fields[0].crop = 'wheat';
  s.buildings.push({ id: 'b9', kind: 'stable', x: 4, y: 4, upgraded: false, trough: 3 });
  s.buildings.push({ id: 'b10', kind: 'coop', x: 4, y: 6, upgraded: true, trough: 0 });
  s.animals.push({ id: 'a11', species: 'horse', breed: 'pony', buildingId: 'b9', youngMsLeft: 0, sick: false,
    cycleMs: -1, productReady: false, treat: false, bornOnFarm: false });
  s.animals.push({ id: 'a12', species: 'chicken', breed: null, buildingId: 'b10', youngMsLeft: 0, sick: false,
    cycleMs: 100, productReady: true, treat: false, bornOnFarm: true });
  s.ownedBreeds = ['pony'];
  return s;
}
const broken = (fn: (o: any) => void): string => {
  const o = JSON.parse(serialize(richState()));
  fn(o);
  return JSON.stringify(o);
};

describe('deserialize: enum and reference checks', () => {
  it('accepts the rich valid state', () => {
    expect(deserialize(serialize(richState()))).toEqual(richState());
  });
  it.each([
    ['unknown crop', (o: any) => { o.fields[0].crop = 'banana'; }],
    ['non-finite field growth', (o: any) => { o.fields[0].growthMs = 'x'; }],
    ['field coordinates not numbers', (o: any) => { o.fields[0].x = null; }],
    ['field watered not boolean', (o: any) => { o.fields[0].watered = 1; }],
    ['field id missing', (o: any) => { delete o.fields[0].id; }],
    ['unknown building kind', (o: any) => { o.buildings[0].kind = 'castle'; }],
    ['building trough not a number', (o: any) => { o.buildings[0].trough = null; }],
    ['building upgraded not boolean', (o: any) => { o.buildings[0].upgraded = 'yes'; }],
    ['unknown species', (o: any) => { o.animals[1].species = 'dragon'; }],
    ['unknown breed', (o: any) => { o.animals[0].breed = 'zebra'; }],
    ['horse without a breed', (o: any) => { o.animals[0].breed = null; }],
    ['animal in a missing building', (o: any) => { o.animals[1].buildingId = 'b99'; }],
    ['animal cycle not a number', (o: any) => { o.animals[1].cycleMs = 'soon'; }],
    ['animal flags not boolean', (o: any) => { o.animals[1].productReady = 'no'; }],
    ['unknown weather', (o: any) => { o.weather.kind = 'tornado'; }],
    ['unknown lastSeason', (o: any) => { o.lastSeason = 'monsoon'; }],
    ['unknown owned breed', (o: any) => { o.ownedBreeds = ['zebra']; }],
    ['non-finite storage (null from Infinity)', (o: any) => { o.storage.egg = null; }],
    ['level out of range', (o: any) => { o.level = 0; }],
    ['duplicate ids', (o: any) => { o.buildings[1].id = o.buildings[0].id; o.animals[1].buildingId = o.buildings[0].id; }],
  ])('rejects %s', (_name, fn) => {
    expect(deserialize(broken(fn))).toBeNull();
  });
});
