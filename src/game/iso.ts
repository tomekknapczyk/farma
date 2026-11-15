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
