/**
 * Round 1 of the real pixel art (spec 3.1): a sample set in one style, so the parent and the
 * child can judge it. Registered after the placeholders and overrides the same keys.
 *
 * Style rules
 * - Palette: only `PALETTE` colours (DB32-based, see palette.ts for the ramps).
 * - Light from the top-left: highlights on top/left surfaces, shade on bottom/right.
 * - 1 px outline in a darker shade of the fill (white -> grey, brown -> plum, green -> dark green).
 * - Same sizes as the placeholders (tile 32x16, crop 32x24, building 64x48, animal 16x16),
 *   except the tree, which is taller (it is placed with origin (0.5, 1)).
 * - `@winter` variants: snow on top surfaces; building `@winter` keeps identical walls because
 *   it is drawn as a fading roof overlay on top of the base sprite.
 *
 * Legend (PALETTE chars used here)
 *   w white  P pale blue  e light grey  E grey  (snow, chicken)
 *   G light green  g green  D dark green  c green-black (grass, leaves)
 *   s sand  t tan  b brown  B dark brown  p plum  n night (soil, wood, pony)
 *   y gold  A ochre  O olive dark (wheat)    r red  R light red (roof, comb)
 *   o orange (beak, legs)  k black (eyes)    u L C blues (water glints)
 */
import { PALETTE } from '../palette';
import type { PixelSprite } from '../pixelmap';

type Grid = string[][];

const grid = (w: number, h: number): Grid => Array.from({ length: h }, () => new Array<string>(w).fill('.'));

function put(g: Grid, x: number, y: number, ch: string): void {
  if (y >= 0 && y < g.length && x >= 0 && x < g[0].length) g[y][x] = ch;
}

const get = (g: Grid, x: number, y: number): string =>
  y >= 0 && y < g.length && x >= 0 && x < g[0].length ? g[y][x] : '.';

const sprite = (key: string, g: Grid): PixelSprite => ({ key, palette: PALETTE, rows: g.map((r) => r.join('')) });

/** Hand-drawn rows; rows shorter than `w` are right-padded with '.'. */
function rows(key: string, w: number, src: string[], recolor: Record<string, string> = {}): PixelSprite {
  return { key, palette: PALETTE, rows: src.map((r) => [...r.padEnd(w, '.')].map((ch) => recolor[ch] ?? ch).join('')) };
}

/** Paste a small hand-drawn stamp with its bottom-centre pixel at (cx, by); '.' is transparent. */
function stamp(g: Grid, cx: number, by: number, src: string[]): void {
  const w = Math.max(...src.map((r) => r.length));
  const x0 = cx - Math.floor(w / 2);
  const y0 = by - src.length + 1;
  src.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) if (row[dx] !== '.') put(g, x0 + dx, y0 + dy, row[dx]);
  });
}

/** Snow cap: the topmost opaque pixel of every column becomes `top`, the one below `under`. */
function snowCap(src: string[], top = 'w', under = 'P', skip = ''): string[] {
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

// ---------------------------------------------------------------------------------------------
// Ground tiles 32x16
// ---------------------------------------------------------------------------------------------

type Edge = 'tl' | 'tr' | 'bl' | 'br' | null;

/** 32x16 diamond; `fill` gets the pixel and its edge band (2 px wide, as iso lines step 2 px). */
function diamond(key: string, fill: (x: number, y: number, edge: Edge) => string, extra?: (g: Grid) => void): PixelSprite {
  const g = grid(32, 16);
  for (let y = 0; y < 16; y++) {
    const hw = y < 8 ? (y + 1) * 2 : (16 - y) * 2;
    const left = 16 - hw;
    const right = 15 + hw;
    for (let x = left; x <= right; x++) {
      const top = y < 8;
      const edge: Edge = x < left + 2 ? (top ? 'tl' : 'bl') : x > right - 2 ? (top ? 'tr' : 'br') : null;
      put(g, x, y, fill(x, y, edge));
    }
  }
  extra?.(g);
  return sprite(key, g);
}

const inDiamond = (x: number, y: number): boolean => {
  if (y < 0 || y > 15) return false;
  const hw = y < 8 ? (y + 1) * 2 : (16 - y) * 2;
  return x >= 16 - hw + 2 && x <= 15 + hw - 2; // inside the edge band
};

/** Small detail stamps placed by top-left corner, clipped to the inside of the diamond. */
function details(g: Grid, list: [number, number, string[]][]): void {
  for (const [x0, y0, src] of list) {
    src.forEach((row, dy) => {
      for (let dx = 0; dx < row.length; dx++) {
        if (row[dx] !== '.' && inDiamond(x0 + dx, y0 + dy)) put(g, x0 + dx, y0 + dy, row[dx]);
      }
    });
  }
}

// grass: 'v' tufts of dark blades with a lit tip, scattered irregularly
const TUFT = ['G.G', 'D.D', '.D.'];
const TUFT_SMALL = ['G', 'D'];
const GRASS_DETAILS: [number, number, string[]][] = [
  [13, 2, TUFT], [6, 6, TUFT], [21, 5, TUFT_SMALL], [16, 8, TUFT], [25, 8, TUFT_SMALL],
  [9, 10, TUFT_SMALL], [19, 11, TUFT], [27, 6, ['G']], [4, 8, ['G']], [11, 6, ['G']],
  [17, 4, ['G']], [23, 10, ['G']], [13, 12, ['G']], [10, 4, ['G']],
];

// winter grass: snow with soft drifts (lit top, blue-grey shade under) and a few sparkles
const DRIFT = ['.ww.', 'wwww', 'PPPP'];
const DRIFT_SMALL = ['ww', 'PP'];
const SNOW_DETAILS: [number, number, string[]][] = [
  [12, 3, DRIFT], [5, 7, DRIFT_SMALL], [20, 7, DRIFT], [15, 10, DRIFT_SMALL], [25, 8, DRIFT_SMALL],
  [9, 10, ['e']], [22, 4, ['e']], [27, 7, ['P']], [17, 6, ['P']], [11, 7, ['e']], [19, 12, ['P']],
];

function grassTiles(): PixelSprite[] {
  return [
    diamond('tile-grass', (_x, _y, e) => (e === 'tl' || e === 'tr' ? 'G' : e ? 'D' : 'g'), (g) => details(g, GRASS_DETAILS)),
    diamond('tile-grass@winter', (_x, _y, e) => (e === 'bl' ? 'P' : e === 'br' ? 'e' : 'w'), (g) => details(g, SNOW_DETAILS)),
  ];
}

// fields: furrows along the iso axis (x - 2y = const); profile across one 8 px period, light from the left
const furrowPhase = (x: number, y: number): number => (((x - 2 * y) % 8) + 8) % 8;

interface SoilLook { profile: string; edgeTop: string; edgeBottom: string; spots: [number, number, string[]][] }

const DRY: SoilLook = {
  profile: 'pBttbbbB', // groove, lit ridge face, ridge, shaded face
  edgeTop: 'B',
  edgeBottom: 'p',
  spots: [[9, 7, ['s']], [21, 9, ['s']], [15, 4, ['e']], [24, 6, ['s']], [12, 11, ['E']]],
};
const WET: SoilLook = {
  profile: 'npbbBBBp',
  edgeTop: 'p',
  edgeBottom: 'n',
  // small puddles in the grooves with a light glint
  spots: [[7, 7, ['uL']], [17, 4, ['Lu']], [20, 10, ['uLu']], [12, 11, ['C']], [25, 7, ['uC']], [14, 7, ['L']]],
};
const DRY_WINTER: SoilLook = {
  profile: 'pBwPbbBB', // frost on the lit ridge tops
  edgeTop: 'B',
  edgeBottom: 'p',
  spots: [[9, 7, ['w']], [21, 9, ['P']], [15, 4, ['w']]],
};
const WET_WINTER: SoilLook = {
  profile: 'npPebBBp',
  edgeTop: 'p',
  edgeBottom: 'n',
  // frozen puddles: pale ice with a white glint
  spots: [[7, 7, ['eP']], [17, 4, ['Pe']], [20, 10, ['ePw']], [25, 7, ['ew']], [12, 11, ['P']]],
};

function soil(key: string, look: SoilLook): PixelSprite {
  return diamond(
    key,
    (x, y, e) => (e === 'tl' || e === 'tr' ? look.edgeTop : e ? look.edgeBottom : look.profile[furrowPhase(x, y)]),
    (g) => details(g, look.spots),
  );
}

function fieldTiles(): PixelSprite[] {
  return [
    soil('field-dry', DRY),
    soil('field-wet', WET),
    soil('field-dry@winter', DRY_WINTER),
    soil('field-wet@winter', WET_WINTER),
  ];
}

// ---------------------------------------------------------------------------------------------
// Wheat 32x24 (sprite bottom = tile bottom, so the tile diamond is rows 8..23)
// ---------------------------------------------------------------------------------------------

/** Clump stamps per stage, bottom-centre anchored. */
const WHEAT_STAGES: string[][] = [
  // 0: sprouts
  ['G.G', '.g.'],
  // 1: young green leaves
  ['.G.G.', 'G.G.G', '.gGg.', '.DgD.'],
  // 2: tall green stalks with unripe (light green) ears
  [
    '...G...',
    'G..Gg..',
    'Gg.gG.G',
    'gG.Ggag',
    'Gg.D.Gg',
    '.D.D.gG',
    '.D.D.D.',
    '..DDD..',
    '...D...',
  ],
  // 3: ripe golden ears (light grains y, shade t, ochre outline A), ochre stems
  [
    '...y...',
    'y..yt..',
    'yt.ty.y',
    'ty.ytty',
    'yt.A.yt',
    '.A.A.ty',
    '.A.A.A.',
    '..AAA..',
    '...O...',
  ],
];

// 3x3 grid of clumps inside the tile, back to front
const CLUMPS: [number, number][] = [];
for (let s = 0; s <= 4; s++) {
  for (let i = 0; i <= 2; i++) {
    const j = s - i;
    if (j < 0 || j > 2) continue;
    CLUMPS.push([16 + (i - j) * 8, 11 + s * 2 + (s > 2 ? 1 : 0)]);
  }
}

function wheat(stage: number, winter: boolean): PixelSprite {
  const g = grid(32, 24);
  const src = winter && stage > 0 ? snowCap(WHEAT_STAGES[stage], 'w', '') : WHEAT_STAGES[stage];
  for (const [cx, by] of CLUMPS) {
    put(g, cx + 1, by + 1, 'p'); // small shadow at the base (light from the top-left)
    stamp(g, cx, by, src);
  }
  return sprite(`crop-wheat-${stage}${winter ? '@winter' : ''}`, g);
}

function wheatSprites(): PixelSprite[] {
  return [0, 1, 2, 3].flatMap((n) => [wheat(n, false), wheat(n, true)]);
}

// ---------------------------------------------------------------------------------------------
// Coop 64x48: gable end with the door on the lit front-left wall, roof slope over the right wall
// ---------------------------------------------------------------------------------------------

const WALL_H = 11;
const GABLE_H = 12;
const lowerL = (x: number): number => 32 + Math.floor((x - 4) / 2); // left wall bottom, x 4..31
const lowerR = (x: number): number => 46 - Math.floor((x - 32) / 2); // right wall bottom, x 32..60

function edgeSide(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  return (bx - ax) * (py - ay) - (by - ay) * (px - ax);
}
/** Pixel centre inside a convex polygon. */
function inPoly(px: number, py: number, pts: [number, number][]): boolean {
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

interface RoofLook { face: string; line: string; ridge: string; trim: string; outline: string }
const ROOF: RoofLook = { face: 'R', line: 'r', ridge: 's', trim: 'r', outline: 'p' };
const ROOF_SNOW: RoofLook = { face: 'w', line: 'P', ridge: 'w', trim: 'w', outline: 'E' };

// hand-drawn details, stamped by top-left corner
const COOP_DOOR = [ // chicken door, dark inside, with a little hen looking out
  'BBBBBBB',
  'BnnnnnB',
  'BnrnnnB',
  'BnwwnnB',
  'BowwnnB',
  'BnwwwnB',
  'BnnnnnB',
];
const COOP_RAMP = [ // slatted ramp leaning out of the door
  '.sAsAsA',
  'sAsAsA.',
  'AsAsA..',
];
const GABLE_WINDOW = [ // round window in the gable
  '.BBB.',
  'BuLuB',
  'BLuuB',
  'BuuuB',
  '.BBB.',
];

function coop(key: string, roof: RoofLook, winter: boolean): PixelSprite {
  const W = 64;
  const H = 48;
  const g = grid(W, H);
  const mat = grid(W, H); // material per pixel ('w' wall, 'r' roof), used for the outline colour
  const wall = (x: number, y: number, ch: string) => { put(g, x, y, ch); put(mat, x, y, 'w'); };

  // --- front (left) wall + gable triangle: vertical boards, lit from the left
  const apexX = 18;
  const apexY = lowerL(apexX) - WALL_H - GABLE_H;
  for (let x = 4; x <= 31; x++) {
    const gable = Math.max(0, GABLE_H - Math.abs(x - apexX) * (GABLE_H / 14));
    const top = Math.ceil(lowerL(x) - WALL_H - gable);
    for (let y = top; y <= lowerL(x); y++) wall(x, y, x % 4 === 0 ? 'A' : x % 4 === 1 ? 's' : 't');
  }
  // --- right wall: horizontal planks along the iso slope, in shade
  for (let x = 32; x <= 60; x++) {
    for (let y = lowerR(x) - WALL_H; y <= lowerR(x); y++) {
      const k = lowerR(x) - y;
      wall(x, y, k % 3 === 0 ? 'B' : 'b');
    }
  }
  // corner posts and a sill along the ground
  for (let y = lowerL(31) - WALL_H; y <= lowerL(31); y++) { put(g, 31, y, 's'); put(g, 32, y, 'B'); }
  for (let x = 4; x <= 31; x++) put(g, x, lowerL(x), 'B');
  for (let x = 32; x <= 60; x++) put(g, x, lowerR(x), 'p');

  // --- details
  const fx = (x: number) => lowerL(x); // ground line under the front wall
  const stampAt = (x0: number, y0: number, src: string[]) => src.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) if (row[dx] !== '.') put(g, x0 + dx, y0 + dy, row[dx]);
  });
  // door: its sill follows the wall slope, so stamp column by column
  COOP_DOOR[0].split('').forEach((_, dx) => {
    const x = 15 + dx;
    COOP_DOOR.forEach((row, dy) => put(g, x, fx(x) - COOP_DOOR.length + dy, row[dx]));
  });
  stampAt(13, fx(16) - 1, COOP_RAMP);
  stampAt(apexX - 2, apexY + 4, GABLE_WINDOW);
  // side window with a frame and a glint
  for (let x = 42; x <= 50; x++) {
    for (let dy = 4; dy <= 8; dy++) {
      const frame = x === 42 || x === 50 || dy === 4 || dy === 8 || x === 46;
      put(g, x, lowerR(x) - dy, frame ? 's' : dy === 7 && (x === 43 || x === 47) ? 'L' : 'u');
    }
  }

  // --- roof slope over the right wall: apex -> ridge end -> back eave -> front eave
  const A: [number, number] = [apexX - 1, apexY - 1];
  const Rb: [number, number] = [apexX + 29, apexY - 15];
  const E2: [number, number] = [63, lowerR(60) - WALL_H + 2];
  const E1: [number, number] = [33, lowerR(32) - WALL_H + 3];
  const face: [number, number][] = [A, Rb, E2, E1];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!inPoly(x, y, face)) continue;
      const d = y + Math.floor(x / 2); // shingle rows run parallel to the eave
      const row = Math.floor(d / 3);
      let ch = d % 3 === 0 ? roof.line : roof.face;
      if (d % 3 !== 0 && (x + row * 3) % 6 === 0) ch = roof.line; // staggered joints
      put(g, x, y, ch);
      put(mat, x, y, 'r');
    }
  }
  // ridge cap (lit) and the front rake trim
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (get(mat, x, y) !== 'r') continue;
      const topEdge = get(mat, x, y - 1) !== 'r';
      const leftEdge = get(mat, x - 1, y) !== 'r';
      if (topEdge && x <= Rb[0]) put(g, x, y, roof.ridge);
      else if (leftEdge) put(g, x, y, roof.trim);
    }
  }
  // barge board along the left rake of the gable (edge of the hidden back slope)
  for (let x = 4; x <= apexX; x++) {
    let y = 0;
    while (y < H && get(mat, x, y) !== 'w') y++;
    put(g, x, y - 1, roof.trim); put(mat, x, y - 1, 'r');
    put(g, x, y, roof === ROOF ? 'R' : 'P'); put(mat, x, y, 'r');
  }
  if (winter) {
    // snow lip over the eave with a few icicles
    for (let x = 33; x <= 62; x++) {
      let y = H - 1;
      while (y > 0 && get(mat, x, y) !== 'r') y--;
      if (y <= 0) continue;
      put(g, x, y, 'P');
      if (x % 4 === 1 && get(g, x, y + 1) !== '.') { put(g, x, y + 1, 'P'); put(g, x, y + 2, 'e'); }
    }
  }

  // --- outline: every opaque pixel touching transparency, darker shade of its material
  const opaque = (x: number, y: number) => get(g, x, y) !== '.';
  const edges: [number, number][] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (opaque(x, y) && (!opaque(x - 1, y) || !opaque(x + 1, y) || !opaque(x, y - 1) || !opaque(x, y + 1))) edges.push([x, y]);
    }
  }
  for (const [x, y] of edges) put(g, x, y, get(mat, x, y) === 'r' ? roof.outline : 'p');
  return sprite(key, g);
}

function buildingSprites(): PixelSprite[] {
  return [coop('bld-coop', ROOF, false), coop('bld-coop@winter', ROOF_SNOW, true)];
}

// ---------------------------------------------------------------------------------------------
// Animals 16x16, facing left (the scene flips them when walking right)
// ---------------------------------------------------------------------------------------------

// white hen: grey outline, pale-blue shading, red comb, orange beak and legs
const CHICKEN = [
  '................',
  '................',
  '................',
  '....rR..........',
  '...rRrr.........',
  '..EwwwwE........',
  'ooEwkwwE....EE..',
  '.rEwwwwE...EwwE.',
  '.rEwwwwwEEEwwwE.',
  '..EwwwwwwwwwwPE.',
  '..EwwwPPPwwwwPE.',
  '...EwwwPPPwwPPE.',
  '....EePPPPPPPE..',
  '.....EEEEEEEE...',
  '.......o..o.....',
  '......oo.oo.....',
];

// chick: round yellow fluff, ochre outline
const CHICK = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '......AAA.......',
  '.....AyyyA......',
  '....oykyyyA.....',
  '.....AyyyyyAA...',
  '.....AyyyytyA...',
  '......AttttA....',
  '.......AAAA.....',
  '.......o..o.....',
];

// pony: brown coat (b) lit on the back (t), cream mane and tail (s/t), white blaze, plum outline
const PONY = [
  '...pp...........',
  '..pbbp..........',
  '.pbkbsp.........',
  'pbbbbssp........',
  'pwbbbbssp.......',
  'psbpbbbbsp......',
  '.pp.pbbbbstppp..',
  '.....pbttttttps.',
  '.....pbbbbbbbpts',
  '.....pbbbbbbbbts',
  '.....pBbbbbbbBpt',
  '.....pBBBBBBBBpt',
  '.....pbBp.pBbp.s',
  '.....pbBp.pBbp..',
  '.....pbBp.pBbp..',
  '.....nnn..nnn...',
];

// foal: smaller, long legs, short fuzzy mane
const FOAL = [
  '................',
  '................',
  '................',
  '................',
  '....pp..........',
  '...pbbp.........',
  '..pbkbsp........',
  '.pwbbbsp........',
  '.psbpbbbppppp...',
  '..p..pbttttbsp..',
  '.....pbbbbbbbs..',
  '.....pBBBBBBp...',
  '.....pbp..pbp...',
  '.....pbp..pbp...',
  '.....pbp..pbp...',
  '.....nn...nn....',
];

// winter: the pony wears a red blanket (r, lit top R) with a sand trim at the bottom
function blanket(src: string[], top: number, bottom: number, x0: number, x1: number): string[] {
  const out = src.map((r) => [...r.padEnd(16, '.')]);
  for (let y = top; y <= bottom; y++) {
    for (let x = x0; x <= x1; x++) {
      const ch = out[y][x];
      if (ch === 'b' || ch === 't' || ch === 'B') out[y][x] = y === bottom ? 's' : y === top ? 'R' : 'r';
    }
  }
  return out.map((r) => r.join(''));
}

function animalSprites(): PixelSprite[] {
  return [
    rows('chicken', 16, CHICKEN),
    rows('chicken-young', 16, CHICK),
    rows('horse-pony', 16, PONY),
    rows('foal-pony', 16, FOAL),
    rows('horse-pony@winter', 16, blanket(PONY, 7, 10, 6, 12)),
    rows('foal-pony@winter', 16, blanket(FOAL, 9, 10, 7, 11)),
  ];
}

// ---------------------------------------------------------------------------------------------
// Tree 24x27 (taller than the placeholder; placed with origin (0.5, 1))
// ---------------------------------------------------------------------------------------------

const TREE = [
  '........cccccccc........',
  '......ccGGGGgggDcc......',
  '.....cGGGGggggggDDc.....',
  '....cGGGggggGGgggDDc....',
  '...cGGggGGgggggggDDDc...',
  '..cGGggggggggDggggDDDc..',
  '..cGgggggggggDDgggDDDc..',
  '.cGGggGGgggggggggDDDDDc.',
  '.cGgggggggGGggggDDgDDDc.',
  '.cGggggggggggggDDDgDDDc.',
  '.cgggggDggggggggggDDDDc.',
  '.cgggggDDgggGgggDDDDDDc.',
  '..cggggggggggDDDDgDDDc..',
  '..cDggggggDDDDggDDDDDc..',
  '...cDDgggDDDDDDDDDDDc...',
  '....ccDDDDDDDDDDDDcc....',
  '......cccccbbccccc......',
  '.........pbtbBp.........',
  '.........pbtbBp.........',
  '.........pbtbBp.........',
  '.........pbtbBp.........',
  '.........pbtbBp.........',
  '.........pbtbBp.........',
  '........pbbtbBBp........',
  '.......pBbtbbBBBp.......',
  '......pBp.pbBp.pBp......',
  '.......D.DD..DD.........',
];

const CROWN_ROWS = 16; // rows 0..15 are the crown

/** Winter tree: same crown, a thick snow cap on its top and small snow piles on the lit clusters. */
function treeWinter(src: string[]): string[] {
  const out = src.map((r) => [...r]);
  const leaf = (ch: string | undefined) => ch === 'G' || ch === 'g' || ch === 'D';
  for (let x = 0; x < 24; x++) {
    // cap: the first two leaf pixels under the outline of every column, plus a third in the lit half
    let y = src.findIndex((r) => leaf(r[x]));
    if (y < 0 || y >= CROWN_ROWS) continue;
    const depth = x < 12 ? 3 : 2;
    for (let k = 0; k < depth && leaf(src[y + k]?.[x]); k++) out[y + k][x] = k === depth - 1 ? 'P' : 'w';
    if (src[y - 1]?.[x] === 'c') out[y - 1][x] = 'E';
  }
  // piles on the inner highlight clusters: top pixel of each G run becomes snow
  for (let y = 3; y < CROWN_ROWS; y++) {
    for (let x = 0; x < 24; x++) {
      if (src[y][x] === 'G' && src[y - 1][x] !== 'G' && out[y][x] === 'G') { out[y][x] = 'w'; if (out[y + 1][x] === 'G') out[y + 1][x] = 'P'; }
    }
  }
  return out.map((r) => r.join(''));
}

function treeSprites(): PixelSprite[] {
  return [rows('tree', 24, TREE), rows('tree@winter', 24, treeWinter(TREE))];
}

// ---------------------------------------------------------------------------------------------

export const ROUND1: PixelSprite[] = [
  ...grassTiles(),
  ...fieldTiles(),
  ...wheatSprites(),
  ...buildingSprites(),
  ...animalSprites(),
  ...treeSprites(),
];
