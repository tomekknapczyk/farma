import { describe, expect, it } from 'vitest';
import { ANCHOR_SPOTS, animalAnchors } from '../../src/game/render/animalAnchors';
import { isoToScreen } from '../../src/game/iso';

/** Is world point (x, y) inside the front (lower) half of the 2x2 footprint diamond of a building at (bx, by)? */
function inFrontHalf(bx: number, by: number, x: number, y: number): boolean {
  const { sx, sy } = isoToScreen(bx, by);
  const dx = x - sx;
  const dy = y - sy;
  return dy >= 16 && dy < 32 && Math.abs(dx) <= 2 * (32 - dy);
}

const ids = (n: number) => Array.from({ length: n }, (_, i) => `a${i + 3}`);

describe('animalAnchors', () => {
  it('up to 8 animals get distinct spots, at least 9 px apart, inside the front of the footprint', () => {
    for (let n = 1; n <= ANCHOR_SPOTS.length; n++) {
      const m = animalAnchors(5, 2, ids(n));
      expect(m.size).toBe(n);
      const pts = [...m.values()];
      for (const p of pts) expect(inFrontHalf(5, 2, p.x, p.y)).toBe(true);
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          expect(Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y)).toBeGreaterThanOrEqual(9);
        }
      }
    }
  });

  it('is deterministic per animal id: input order does not matter', () => {
    const a = animalAnchors(4, 4, ['a7', 'a12', 'a9']);
    const b = animalAnchors(4, 4, ['a12', 'a9', 'a7']);
    expect([...b.entries()].sort()).toEqual([...a.entries()].sort());
  });

  it('ranks ids numerically, so a newly bought / born animal never moves the older ones', () => {
    const before = animalAnchors(4, 4, ['a9', 'a10']);
    const after = animalAnchors(4, 4, ['a9', 'a10', 'a11']);
    expect(after.get('a9')).toEqual(before.get('a9'));
    expect(after.get('a10')).toEqual(before.get('a10'));
  });

  it('follows the building position', () => {
    const p = animalAnchors(0, 0, ['a1']).get('a1');
    const q = animalAnchors(3, 1, ['a1']).get('a1');
    const d = isoToScreen(3, 1);
    expect(q).toEqual({ x: (p?.x ?? 0) + d.sx, y: (p?.y ?? 0) + d.sy });
  });
});
