import { describe, expect, it } from 'vitest';
import { isoToScreen, nearestZoomIndex, screenToIso, TILE_H, TILE_W, ZOOM_STEPS } from '../../src/game/iso';

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
