/**
 * Small drawing kit shared by the art rounds: grids, stamps, snow caps, polygons, and `paint`,
 * which turns a material mask into a shaded sprite with a 1 px outline (the round-1 style).
 */
import { PALETTE } from '../palette';
import type { PixelSprite } from '../pixelmap';

export type Grid = string[][];

export const grid = (w: number, h: number): Grid => Array.from({ length: h }, () => new Array<string>(w).fill('.'));

export function put(g: Grid, x: number, y: number, ch: string): void {
  if (y >= 0 && y < g.length && x >= 0 && x < g[0].length) g[y][x] = ch;
}

export const get = (g: Grid, x: number, y: number): string =>
  y >= 0 && y < g.length && x >= 0 && x < g[0].length ? g[y][x] : '.';

export const sprite = (key: string, g: Grid): PixelSprite => ({ key, palette: PALETTE, rows: g.map((r) => r.join('')) });

/** Hand-drawn rows; rows shorter than `w` are right-padded with '.'. */
export function rows(key: string, w: number, src: string[], recolor: Record<string, string> = {}): PixelSprite {
  return { key, palette: PALETTE, rows: src.map((r) => [...r.padEnd(w, '.')].map((ch) => recolor[ch] ?? ch).join('')) };
}

/** Paste a small hand-drawn stamp with its bottom-centre pixel at (cx, by); '.' is transparent. */
export function stamp(g: Grid, cx: number, by: number, src: string[]): void {
  const w = Math.max(...src.map((r) => r.length));
  const x0 = cx - Math.floor(w / 2);
  const y0 = by - src.length + 1;
  src.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) if (row[dx] !== '.') put(g, x0 + dx, y0 + dy, row[dx]);
  });
}

/** Paste a stamp by its top-left corner. */
export function stampAt(g: Grid, x0: number, y0: number, src: string[]): void {
  src.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) if (row[dx] !== '.') put(g, x0 + dx, y0 + dy, row[dx]);
  });
}

/** Snow cap: the topmost opaque pixel of every column becomes `top`, the one below `under`. */
export function snowCap(src: string[], top = 'w', under = 'P', skip = ''): string[] {
  const out = src.map((r) => [...r]);
  const w = Math.max(...src.map((r) => r.length));
  for (let x = 0; x < w; x++) {
    const y = out.findIndex((r) => r[x] !== undefined && r[x] !== '.' && !skip.includes(r[x]));
    if (y < 0) continue;
    out[y][x] = top;
    if (under && out[y + 1]?.[x] !== undefined && out[y + 1][x] !== '.') out[y + 1][x] = under;
  }
  return out.map((r) => r.join(''));
}

function edgeSide(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  return (bx - ax) * (py - ay) - (by - ay) * (px - ax);
}

/** Pixel centre inside a convex polygon. */
export function inPoly(px: number, py: number, pts: [number, number][]): boolean {
  let pos = false;
  let neg = false;
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % pts.length];
    const d = edgeSide(px + 0.5, py + 0.5, ax, ay, bx, by);
    if (d > 0) pos = true;
    if (d < 0) neg = true;
  }
  return !(pos && neg);
}

/**
 * A material of a `paint` mask. `fill` is the body colour; `light` goes on pixels whose top or
 * left neighbour is empty, `shade` on pixels whose bottom or right neighbour is empty (light from
 * the top-left); `line` is the 1 px outline drawn just outside the shape. A plain string is a
 * fixed colour (no shading, no outline of its own), e.g. an eye.
 */
export interface Mat { fill: string; light?: string; shade?: string; line?: string }

/**
 * Mask -> sprite. Every mask char is a material key ('.' empty). The outline is added outside
 * the mask, so leave a 1 px margin. Outline colour comes from the first filled 4-neighbour,
 * checked below, above, right, left (so ground-side parts such as hooves own their outline).
 */
export function paint(key: string, w: number, mask: string[], mats: Record<string, Mat | string>): PixelSprite {
  const m = mask.map((r) => [...r.padEnd(w, '.')]);
  const h = m.length;
  const at = (x: number, y: number) => (y >= 0 && y < h && x >= 0 && x < w ? m[y][x] : '.');
  const g = grid(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = m[y][x];
      if (ch === '.') continue;
      const mat = mats[ch];
      if (mat === undefined) throw new Error(`${key}: no material '${ch}'`);
      if (typeof mat === 'string') { g[y][x] = mat; continue; }
      let c = mat.fill;
      if (mat.light && at(x, y - 1) === '.') c = mat.light;
      else if (mat.shade && at(x, y + 1) === '.') c = mat.shade;
      else if (mat.shade && at(x + 1, y) === '.') c = mat.shade;
      else if (mat.light && at(x - 1, y) === '.') c = mat.light;
      g[y][x] = c;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (m[y][x] !== '.') continue;
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const mat = mats[at(x + dx, y + dy)];
        if (mat !== undefined && typeof mat !== 'string' && mat.line) { g[y][x] = mat.line; break; }
      }
    }
  }
  return sprite(key, g);
}

/** Copy rows with a character map applied (for recolouring masks or sprites). */
export const recolor = (src: string[], map: Record<string, string>): string[] =>
  src.map((r) => [...r].map((ch) => map[ch] ?? ch).join(''));
