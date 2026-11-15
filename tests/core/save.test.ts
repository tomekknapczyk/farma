import { describe, it, expect, vi } from 'vitest';
import { serialize, deserialize, loadGame, saveGame, exportFileName, SAVE_KEY, CORRUPT_KEY } from '../../src/core/save';
import { createInitialState } from '../../src/core/state';

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
