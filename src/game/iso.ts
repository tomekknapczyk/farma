import { MAP_SIZE } from '../core/config';

export const TILE_W = 32;
export const TILE_H = 16;
export const ZOOM_STEPS = [2, 3, 4];

/** Top corner of tile (x, y)'s diamond in world pixels. The diamond spans sx±16, sy..sy+16. */
export function isoToScreen(x: number, y: number): { sx: number; sy: number } {
  return { sx: (x - y) * (TILE_W / 2), sy: (x + y) * (TILE_H / 2) };
}

/** Tile whose diamond contains the world point (sx, sy). */
export function screenToIso(sx: number, sy: number): { x: number; y: number } {
  const a = sx / TILE_W;
  const b = sy / TILE_H;
  return { x: Math.floor(b + a), y: Math.floor(b - a) };
}

/** Index in ZOOM_STEPS of the step closest to `zoom`. */
export function nearestZoomIndex(zoom: number): number {
  let best = 0;
  for (let i = 1; i < ZOOM_STEPS.length; i++) {
    if (Math.abs(ZOOM_STEPS[i] - zoom) < Math.abs(ZOOM_STEPS[best] - zoom)) best = i;
  }
  return best;
}

/**
 * Top tile of the footprint placed at world point `w`. Snapped placements (parcels) take the grid cell;
 * otherwise the footprint is centred on the point: for 2x2 the anchor is the tile corner nearest to the
 * finger minus one, so the finger is always on one of the four tiles (1x1 = the tile under the finger).
 */
export function placementAnchor(w: { x: number; y: number }, p: { w: number; h: number; snap?: number }): { x: number; y: number } {
  const fx = w.y / TILE_H + w.x / TILE_W; // fractional iso coordinates (see screenToIso)
  const fy = w.y / TILE_H - w.x / TILE_W;
  if (p.snap) return { x: Math.floor(Math.floor(fx) / p.snap) * p.snap, y: Math.floor(Math.floor(fy) / p.snap) * p.snap };
  const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v));
  return { x: clamp(Math.round(fx - p.w / 2), MAP_SIZE - p.w), y: clamp(Math.round(fy - p.h / 2), MAP_SIZE - p.h) };
}
