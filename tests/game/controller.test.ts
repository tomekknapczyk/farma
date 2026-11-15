// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameController } from '../../src/game/controller';
import { MAX_DT_MS } from '../../src/core/config';
import { SAVE_KEY, serialize } from '../../src/core/save';
import { createInitialState } from '../../src/core/state';
import type { ActionResult } from '../../src/core/types';

function fakeStore(init: Record<string, string> = {}) {
  const data = { ...init };
  return {
    data,
    getItem: vi.fn((k: string) => (k in data ? data[k] : null)),
    setItem: vi.fn((k: string, v: string) => { data[k] = v; }),
  };
}
const opts = (o: Partial<{ speed: number; seed: number; debug: boolean }> = {}) => ({ speed: 1, seed: 1, debug: false, ...o });
function setVisibility(v: 'hidden' | 'visible') {
  Object.defineProperty(document, 'visibilityState', { value: v, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}
const file = (text: string) => ({ text: async () => text }) as unknown as File;

describe('GameController', () => {
  beforeEach(() => setVisibility('visible'));

  it('clamps a huge realDt to MAX_DT_MS * speed of game time', () => {
    const c = new GameController(fakeStore(), opts({ speed: 3 }));
    c.step(3_600_000);
    expect(c.state.timeMs).toBeLessThanOrEqual(MAX_DT_MS * 3);
    expect(c.state.timeMs).toBeGreaterThan(0);
    c.dispose();
  });

  it('ignores non-finite or negative dt', () => {
    const c = new GameController(fakeStore(), opts());
    c.step(NaN); c.step(-5);
    expect(c.state.timeMs).toBe(0);
    c.dispose();
  });

  it('hidden: step is a no-op; first step after visible is discarded', () => {
    const c = new GameController(fakeStore(), opts());
    setVisibility('hidden');
    c.step(500);
    expect(c.state.timeMs).toBe(0);
    setVisibility('visible');
    c.step(500);
    expect(c.state.timeMs).toBe(0);
    c.step(500);
    expect(c.state.timeMs).toBe(500);
    c.dispose();
  });

  it('autosaves after 5 s of real time', () => {
    const st = fakeStore();
    const c = new GameController(st, opts());
    for (let i = 0; i < 4; i++) c.step(1000);
    expect(st.setItem).not.toHaveBeenCalled();
    c.step(1000);
    expect(st.setItem).toHaveBeenCalledTimes(1);
    c.dispose();
  });

  it('saves when the tab becomes hidden', () => {
    const st = fakeStore();
    const c = new GameController(st, opts());
    setVisibility('hidden');
    expect(st.setItem).toHaveBeenCalled();
    c.dispose();
  });

  it('debug bonus only for fresh state', () => {
    expect(new GameController(fakeStore(), opts({ debug: true })).state.coins).toBe(1050);
    const s = createInitialState(1); s.coins = 77;
    const st = fakeStore({ [SAVE_KEY]: serialize(s) });
    expect(new GameController(st, opts({ debug: true })).state.coins).toBe(77);
  });

  it('importSave rejects bad JSON without touching store or state', async () => {
    const st = fakeStore();
    const c = new GameController(st, opts());
    const before = c.state;
    expect(await c.importSave(file('{nope'))).toBe(false);
    expect(st.setItem).not.toHaveBeenCalled();
    expect(c.state).toBe(before);
    c.dispose();
  });

  it('importSave returns false when reading the file throws', async () => {
    const c = new GameController(fakeStore(), opts());
    const f = { text: async () => { throw new Error('x'); } } as unknown as File;
    expect(await c.importSave(f)).toBe(false);
    c.dispose();
  });

  it('importSave with valid file replaces state, saves and notifies', async () => {
    const st = fakeStore();
    const c = new GameController(st, opts());
    const fn = vi.fn(); c.subscribe(fn);
    const s = createInitialState(1); s.coins = 424;
    expect(await c.importSave(file(serialize(s)))).toBe(true);
    expect(c.state.coins).toBe(424);
    expect(st.setItem).toHaveBeenCalled();
    expect(fn).toHaveBeenCalled();
    c.dispose();
  });

  it('act saves on ok and not on failure', () => {
    const st = fakeStore();
    const c = new GameController(st, opts());
    const ok = (): ActionResult => ({ ok: true });
    const no = (): ActionResult => ({ ok: false, reason: 'invalid' });
    expect(c.act(no).ok).toBe(false);
    expect(st.setItem).not.toHaveBeenCalled();
    expect(c.act(ok).ok).toBe(true);
    expect(st.setItem).toHaveBeenCalledTimes(1);
    c.dispose();
  });

  it('act does not throw when storage fails', () => {
    const st = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
    const c = new GameController(st, opts());
    expect(() => c.act(() => ({ ok: true }))).not.toThrow();
    c.dispose();
  });
});
