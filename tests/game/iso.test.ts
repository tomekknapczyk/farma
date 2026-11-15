import { describe, expect, it } from 'vitest';
import { isoToScreen, nearestZoomIndex, placementAnchor, screenToIso, TILE_H, TILE_W, ZOOM_STEPS } from '../../src/game/iso';

describe('iso', () => {
  it('constants', () => {
    expect(TILE_W).toBe(32);
    expect(TILE_H).toBe(16);
    expect(ZOOM_STEPS).toEqual([2, 3, 4]);
  });

  it('isoToScreen maps basic tiles', () => {
    expect(isoToScreen(0, 0)).toEqual({ sx: 0, sy: 0 });
    expect(isoToScreen(1, 0)).toEqual({ sx: 16, sy: 8 });
    expect(isoToScreen(0, 1)).toEqual({ sx: -16, sy: 8 });
  });

  it('screenToIso inverts isoToScreen at the diamond centre for the whole map', () => {
    for (let x = 0; x < 16; x++) {
      for (let y = 0; y < 16; y++) {
        const { sx, sy } = isoToScreen(x, y);
        expect(screenToIso(sx, sy + 8)).toEqual({ x, y });
      }
    }
  });

  it('screenToIso hits the diamond near its edges', () => {
    const { sx, sy } = isoToScreen(3, 7);
    // just inside the left, right, top and bottom corners
    expect(screenToIso(sx - 15, sy + 8)).toEqual({ x: 3, y: 7 });
    expect(screenToIso(sx + 15, sy + 8)).toEqual({ x: 3, y: 7 });
    expect(screenToIso(sx, sy + 1)).toEqual({ x: 3, y: 7 });
    expect(screenToIso(sx, sy + 15)).toEqual({ x: 3, y: 7 });
  });
});

describe('nearestZoomIndex', () => {
  it('snaps to the closest zoom step', () => {
    expect(nearestZoomIndex(1)).toBe(0);
    expect(nearestZoomIndex(2.4)).toBe(0);
    expect(nearestZoomIndex(2.6)).toBe(1);
    expect(nearestZoomIndex(3.6)).toBe(2);
    expect(nearestZoomIndex(9)).toBe(2);
  });
});

describe('placementAnchor', () => {
  /** world point at fractional iso position (fx, fy) */
  const at = (fx: number, fy: number) => isoToScreen(fx, fy);
  const pt = (fx: number, fy: number) => { const p = at(fx, fy); return { x: p.sx, y: p.sy }; };

  it('1x1: the tile under the finger', () => {
    expect(placementAnchor(pt(5.5, 6.5), { w: 1, h: 1 })).toEqual({ x: 5, y: 6 });
    expect(placementAnchor(pt(5.9, 6.1), { w: 1, h: 1 })).toEqual({ x: 5, y: 6 });
  });
  it('2x2: centred, the tapped tile is always inside the footprint', () => {
    for (const [fx, fy] of [[5.1, 5.1], [5.9, 5.9], [5.2, 5.8], [5.5, 5.5], [7.49, 3.51]]) {
      const a = placementAnchor(pt(fx, fy), { w: 2, h: 2 });
      const t = { x: Math.floor(fx), y: Math.floor(fy) };
      expect(t.x - a.x === 0 || t.x - a.x === 1, `${fx},${fy}`).toBe(true);
      expect(t.y - a.y === 0 || t.y - a.y === 1, `${fx},${fy}`).toBe(true);
    }
    // finger near the corner shared by tiles (5,5),(6,5),(5,6),(6,6): that block
    expect(placementAnchor(pt(5.9, 5.9), { w: 2, h: 2 })).toEqual({ x: 5, y: 5 });
    expect(placementAnchor(pt(6.1, 6.1), { w: 2, h: 2 })).toEqual({ x: 5, y: 5 });
  });
  it('2x2: clamped to the map', () => {
    expect(placementAnchor(pt(0.2, 0.2), { w: 2, h: 2 })).toEqual({ x: 0, y: 0 });
    expect(placementAnchor(pt(15.8, 15.8), { w: 2, h: 2 })).toEqual({ x: 14, y: 14 });
  });
  it('snap: the grid cell under the finger', () => {
    expect(placementAnchor(pt(9.5, 2.5), { w: 4, h: 4, snap: 4 })).toEqual({ x: 8, y: 0 });
  });
});
