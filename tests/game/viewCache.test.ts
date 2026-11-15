import { describe, expect, it, vi } from 'vitest';
import { ViewCache } from '../../src/game/render/viewCache';

interface V { id: string; x: number; destroyed: boolean }

/** Mirrors FarmView's refresh: sync to the generation, then create views only for unseen ids. */
function refresh(cache: ViewCache<V>, generation: number, objects: { id: string; x: number }[]): void {
  cache.sync(generation);
  for (const o of objects) if (!cache.get(o.id)) cache.set(o.id, { id: o.id, x: o.x, destroyed: false });
  cache.prune(new Set(objects.map((o) => o.id)));
}

describe('ViewCache', () => {
  const make = () => {
    const destroy = vi.fn((v: V) => { v.destroyed = true; });
    return { cache: new ViewCache<V>(destroy), destroy };
  };

  it('keeps views for the same id within one generation', () => {
    const { cache, destroy } = make();
    refresh(cache, 0, [{ id: 'b9', x: 2 }]);
    const v = cache.get('b9');
    refresh(cache, 0, [{ id: 'b9', x: 2 }]);
    expect(cache.get('b9')).toBe(v);
    expect(destroy).not.toHaveBeenCalled();
  });

  it('a reused id after a state swap (import / new game) gets a fresh view at the new place', () => {
    const { cache } = make();
    refresh(cache, 0, [{ id: 'b9', x: 2 }]);
    const old = cache.get('b9')!;
    refresh(cache, 1, [{ id: 'b9', x: 8 }]); // other farm: same id, other building
    expect(old.destroyed).toBe(true);
    expect(cache.get('b9')!.x).toBe(8);
  });

  it('sync reports a rebuild only on an actual change (not on the first call)', () => {
    const { cache } = make();
    expect(cache.sync(0)).toBe(false);
    expect(cache.sync(0)).toBe(false);
    expect(cache.sync(1)).toBe(true);
  });

  it('prune destroys views of removed objects', () => {
    const { cache } = make();
    refresh(cache, 0, [{ id: 'a', x: 0 }, { id: 'b', x: 1 }]);
    const a = cache.get('a')!;
    refresh(cache, 0, [{ id: 'b', x: 1 }]);
    expect(a.destroyed).toBe(true);
    expect(cache.get('a')).toBeUndefined();
  });
});
