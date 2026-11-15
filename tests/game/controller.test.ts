// @vitest-environment happy-dom
import { afterEach, describe, it, expect, beforeEach, vi } from 'vitest';
import { GameController, REVOKE_MS } from '../../src/game/controller';
import { MAX_DT_MS } from '../../src/core/config';
import { CORRUPT_KEY, SAVE_KEY, serialize } from '../../src/core/save';
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

  it('reset replaces the state with a fresh one, saves it and notifies', () => {
    const store = fakeStore();
    const c = new GameController(store, opts());
    c.state.coins = 999;
    const fn = vi.fn();
    c.subscribe(fn);
    c.reset(7);
    expect(c.state.coins).toBe(createInitialState(7).coins);
    expect(JSON.parse(store.data[SAVE_KEY]).coins).toBe(c.state.coins);
    expect(fn).toHaveBeenCalledTimes(1);
    c.dispose();
  });

  it('importSave and reset bump the state generation (views keyed by reused ids must rebuild)', async () => {
    const c = new GameController(fakeStore(), opts());
    expect(c.generation).toBe(0);
    expect(await c.importSave(file(serialize(createInitialState(2))))).toBe(true);
    expect(c.generation).toBe(1);
    expect(await c.importSave(file('{bad'))).toBe(false);
    expect(c.generation).toBe(1);
    c.reset(3);
    expect(c.generation).toBe(2);
    c.act(() => ({ ok: true }));
    expect(c.generation).toBe(2);
    c.dispose();
  });

  it('recoverFromCorrupt moves the raw save to CORRUPT_KEY and starts fresh', () => {
    const s = createInitialState(1); s.coins = 321;
    const raw = serialize(s);
    const st = fakeStore({ [SAVE_KEY]: raw });
    const c = new GameController(st, opts());
    expect(c.state.coins).toBe(321);
    c.recoverFromCorrupt();
    expect(st.data[CORRUPT_KEY]).toBe(raw);
    expect(c.state.coins).toBe(createInitialState(1).coins);
    expect(JSON.parse(st.data[SAVE_KEY]).coins).toBe(c.state.coins);
    expect(c.generation).toBe(1);
    c.dispose();
  });
});

describe('GameController.exportSave', () => {
  let click: ReturnType<typeof vi.fn>;
  let revoke: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers();
    click = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(click);
    URL.createObjectURL = vi.fn(() => 'blob:farma');
    revoke = vi.fn();
    URL.revokeObjectURL = revoke;
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  const stubShare = (share: () => Promise<void>, canShare = true) => {
    vi.stubGlobal('navigator', { ...navigator, maxTouchPoints: 5, canShare: vi.fn(() => canShare), share: vi.fn(share) });
    return navigator as unknown as { share: ReturnType<typeof vi.fn> };
  };

  it('fallback: anchor download, blob URL revoked only after REVOKE_MS', async () => {
    vi.stubGlobal('navigator', { ...navigator, canShare: undefined, share: undefined });
    const c = new GameController(fakeStore(), opts());
    expect(await c.exportSave()).toBe('downloaded');
    expect(click).toHaveBeenCalledTimes(1);
    expect(document.querySelector('a')).toBeNull(); // temporary link removed
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(REVOKE_MS - 1);
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(revoke).toHaveBeenCalledWith('blob:farma');
    c.dispose();
  });

  it('share sheet when files can be shared (iPad): no download', async () => {
    const nav = stubShare(async () => {});
    const c = new GameController(fakeStore(), opts());
    expect(await c.exportSave()).toBe('shared');
    const arg = nav.share.mock.calls[0][0] as { files: File[]; title: string };
    expect(arg.title).toBe('Farma');
    expect(arg.files[0].name).toMatch(/^farma-kopia-\d{4}-\d{2}-\d{2}\.json$/);
    expect(JSON.parse(await arg.files[0].text()).version).toBe(1);
    expect(click).not.toHaveBeenCalled();
    c.dispose();
  });

  it('share sheet dismissed (AbortError): nothing else happens', async () => {
    stubShare(async () => { throw new DOMException('x', 'AbortError'); });
    const c = new GameController(fakeStore(), opts());
    expect(await c.exportSave()).toBe('cancelled');
    expect(click).not.toHaveBeenCalled();
    c.dispose();
  });

  it('share refused for another reason: falls back to the download', async () => {
    stubShare(async () => { throw new DOMException('x', 'NotAllowedError'); });
    const c = new GameController(fakeStore(), opts());
    expect(await c.exportSave()).toBe('downloaded');
    expect(click).toHaveBeenCalledTimes(1);
    c.dispose();
  });

  it('canShare false: download', async () => {
    const nav = stubShare(async () => {}, false);
    const c = new GameController(fakeStore(), opts());
    expect(await c.exportSave()).toBe('downloaded');
    expect(nav.share).not.toHaveBeenCalled();
    c.dispose();
  });

  it('desktop (no touch) downloads even when files could be shared', async () => {
    const nav = stubShare(async () => {});
    (nav as unknown as { maxTouchPoints: number }).maxTouchPoints = 0;
    const c = new GameController(fakeStore(), opts());
    expect(await c.exportSave()).toBe('downloaded');
    expect(nav.share).not.toHaveBeenCalled();
    c.dispose();
  });

  it('returns failed when even the download cannot start', async () => {
    vi.stubGlobal('navigator', { ...navigator, canShare: undefined, share: undefined });
    URL.createObjectURL = vi.fn(() => { throw new Error('no blobs'); });
    const c = new GameController(fakeStore(), opts());
    expect(await c.exportSave()).toBe('failed');
    c.dispose();
  });
});
