/**
 * Placeholder pixel art: simple but clearly isometric sprites for every texture key, so the
 * game is playable before the real art round. Large regular shapes (diamonds, buildings, crop
 * rows) are generated; small creatures and icons are hand-drawn string rows.
 *
 * Sizes: tiles 32x16, crops 32x24 (bottom = tile bottom), buildings 64x48 (2x2 footprint at the
 * bottom), animals 16x16, icons 12x12, trough 16x8, tractor 24x16, tree 16x20.
 */
import { PALETTE } from '../palette';
import type { PixelSprite } from '../pixelmap';

type Grid = string[][];

function grid(w: number, h: number): Grid {
  return Array.from({ length: h }, () => new Array<string>(w).fill('.'));
}

function put(g: Grid, x: number, y: number, ch: string): void {
  if (y >= 0 && y < g.length && x >= 0 && x < g[0].length) g[y][x] = ch;
}

function fromGrid(key: string, g: Grid): PixelSprite {
  return { key, palette: PALETTE, rows: g.map((r) => r.join('')) };
}

/** Hand-drawn rows; shorter rows are right-padded with '.' to `w` (longer rows fail validation). */
function fromRows(key: string, w: number, rows: string[], recolor: Record<string, string> = {}): PixelSprite {
  return {
    key,
    palette: PALETTE,
    rows: rows.map((r) => [...r.padEnd(w, '.')].map((ch) => recolor[ch] ?? ch).join('')),
  };
}

// ---------------------------------------------------------------------------------------------
// Tiles and soil
// ---------------------------------------------------------------------------------------------

/** 32x16 isometric diamond with a darker 1px (2px horizontal) edge. */
function diamond(key: string, edge: string, fill: (x: number, y: number) => string): PixelSprite {
  const W = 32;
  const H = 16;
  const g = grid(W, H);
  for (let y = 0; y < H; y++) {
    const hw = y < H / 2 ? (y + 1) * 2 : (H - y) * 2;
    const left = W / 2 - hw;
    const right = W / 2 + hw - 1;
    for (let x = left; x <= right; x++) {
      put(g, x, y, x < left + 2 || x > right - 2 ? edge : fill(x, y));
    }
  }
  return fromGrid(key, g);
}

/** Deterministic pseudo-random speckle (no visible lines), roughly 1 in n pixels. */
const speckle = (x: number, y: number, n: number) => {
  let h = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) % n === 0;
};
const furrow = (x: number, y: number) => (((x - 2 * y) % 8) + 8) % 8 < 2; // rows along the iso x axis

function tiles(): PixelSprite[] {
  return [
    diamond('tile-grass', 'D', (x, y) => (speckle(x, y, 11) ? 'G' : speckle(x + 3, y, 17) ? 'd' : 'g')),
    diamond('tile-grass@autumn', 'O', (x, y) => (speckle(x, y, 11) ? 'o' : speckle(x + 3, y, 17) ? 'A' : 'a')),
    diamond('tile-grass@winter', 'e', (x, y) => (speckle(x, y, 11) ? 'P' : speckle(x + 3, y, 17) ? 'e' : 'w')),
    diamond('tile-locked', 'c', (x, y) => (speckle(x, y, 11) ? 'O' : 'D')),
    diamond('field-dry', 'B', (x, y) => (furrow(x, y) ? 'B' : speckle(x, y, 13) ? 't' : 'b')),
    diamond('field-wet', 'p', (x, y) => (furrow(x, y) ? 'p' : 'B')),
  ];
}

// ---------------------------------------------------------------------------------------------
// Crops: 32x24, four tufts on the tile, taller with each stage
// ---------------------------------------------------------------------------------------------

type Tuft = (g: Grid, bx: number, by: number, stage: number) => void;

const TUFTS: [number, number][] = [[16, 12], [8, 16], [24, 16], [16, 20]]; // back to front

const wheat: Tuft = (g, bx, by, stage) => {
  if (stage === 0) {
    put(g, bx - 1, by, 'G'); put(g, bx + 1, by, 'G'); put(g, bx, by - 1, 'G');
    return;
  }
  const h = [0, 4, 6, 8][stage];
  const stem = stage === 3 ? 'A' : stage === 2 ? 'a' : 'g';
  for (const dx of [-2, 0, 2]) {
    const sh = dx === 0 ? h : h - 1;
    for (let i = 0; i < sh; i++) put(g, bx + dx, by - i, stem);
    if (stage >= 2) {
      const head = stage === 3 ? 'y' : 'G';
      put(g, bx + dx, by - sh, head); put(g, bx + dx, by - sh - 1, head);
      if (stage === 3) put(g, bx + dx + 1, by - sh, 'A');
    }
  }
};

const carrot: Tuft = (g, bx, by, stage) => {
  const h = [1, 3, 4, 5][stage];
  for (let i = 0; i < h; i++) put(g, bx, by - i, 'g');
  if (stage >= 1) {
    for (let i = 1; i < h; i++) { put(g, bx - 1 - (i >> 1), by - i, 'd'); put(g, bx + 1 + (i >> 1), by - i, 'd'); }
  }
  if (stage === 3) { put(g, bx - 1, by, 'o'); put(g, bx, by, 'o'); put(g, bx + 1, by, 'o'); put(g, bx, by + 1, 'o'); }
};

const corn: Tuft = (g, bx, by, stage) => {
  const h = [2, 6, 10, 13][stage];
  for (let i = 0; i < h; i++) { put(g, bx, by - i, 'd'); put(g, bx + 1, by - i, stage === 0 ? 'G' : 'D'); }
  for (let i = 2; i < h - 1; i += 3) { put(g, bx - 1, by - i, 'g'); put(g, bx + 2, by - i - 1, 'g'); }
  if (stage >= 2) { put(g, bx, by - h, stage === 3 ? 'A' : 'a'); put(g, bx + 1, by - h - 1, stage === 3 ? 'A' : 'a'); }
  if (stage === 3) for (let i = 4; i < 7; i++) { put(g, bx + 2, by - i, 'y'); put(g, bx + 3, by - i, 'y'); }
};

const pumpkin: Tuft = (g, bx, by, stage) => {
  if (stage === 0) { put(g, bx, by, 'G'); put(g, bx, by - 1, 'G'); return; }
  for (let dx = -2; dx <= 2; dx++) put(g, bx + dx, by, 'g');
  put(g, bx - 1, by - 1, 'd'); put(g, bx + 1, by - 1, 'd');
  if (stage === 2) { put(g, bx, by - 1, 'o'); put(g, bx + 1, by - 1, 'o'); put(g, bx, by - 2, 'o'); }
  if (stage === 3) {
    for (let dy = 0; dy < 4; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if ((dy === 0 || dy === 3) && Math.abs(dx) === 2) continue;
        put(g, bx + dx, by - dy, dx === -1 || dx === 1 ? 'r' : 'o');
      }
    }
    put(g, bx, by - 4, 'D');
  }
};

function crops(): PixelSprite[] {
  const out: PixelSprite[] = [];
  const kinds: Record<string, Tuft> = { wheat, carrot, corn, pumpkin };
  for (const [name, tuft] of Object.entries(kinds)) {
    for (let stage = 0; stage < 4; stage++) {
      const g = grid(32, 24);
      for (const [bx, by] of TUFTS) tuft(g, bx, by, stage);
      out.push(fromGrid(`crop-${name}-${stage}`, g));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Buildings: 64x48, box on a 2x2 footprint with a lit front wall, darker side wall, hip roof
// ---------------------------------------------------------------------------------------------

interface BuildingColors { front: string; side: string; roofL: string; roofR: string; door: string; frame: string }

function sideOf(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  return (bx - ax) * (py - ay) - (by - ay) * (px - ax);
}
function inTri(px: number, py: number, t: number[]): boolean {
  const [ax, ay, bx, by, cx, cy] = t;
  const d1 = sideOf(px, py, ax, ay, bx, by);
  const d2 = sideOf(px, py, bx, by, cx, cy);
  const d3 = sideOf(px, py, cx, cy, ax, ay);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

function building(key: string, c: BuildingColors): PixelSprite {
  const W = 64;
  const H = 48;
  const WALL = 13;
  const g = grid(W, H);
  const lowerL = (x: number) => 32 + Math.floor((x - 4) / 2); // left wall bottom edge, x 4..31
  const lowerR = (x: number) => 46 - Math.floor((x - 32) / 2); // right wall bottom edge, x 32..60
  for (let x = 4; x <= 31; x++) for (let y = lowerL(x) - WALL; y <= lowerL(x); y++) put(g, x, y, c.front);
  for (let x = 32; x <= 60; x++) for (let y = lowerR(x) - WALL; y <= lowerR(x); y++) put(g, x, y, c.side);
  // door on the front wall
  for (let x = 13; x <= 21; x++) {
    for (let y = lowerL(x) - 8; y <= lowerL(x) - 1; y++) {
      const edge = x === 13 || x === 21 || y === lowerL(x) - 8;
      put(g, x, y, edge ? c.frame : c.door);
    }
  }
  // window on the side wall
  for (let x = 42; x <= 49; x++) {
    for (let y = lowerR(x) - 9; y <= lowerR(x) - 5; y++) {
      const edge = x === 42 || x === 49 || y === lowerR(x) - 9 || y === lowerR(x) - 5;
      put(g, x, y, edge ? c.frame : 'C');
    }
  }
  // hip roof: two visible faces meeting at the apex, eaves overhang the walls slightly
  const left = [2, 20, 32, 35, 32, 0];
  const right = [32, 35, 62, 20, 32, 0];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (x <= 32 && inTri(x, y, left)) put(g, x, y, (y - (x >> 1)) % 4 === 0 ? c.roofR : c.roofL);
      else if (x > 32 && inTri(x, y, right)) put(g, x, y, (y + (x >> 1)) % 4 === 0 ? 'n' : c.roofR);
    }
  }
  for (let y = 1; y <= 34; y++) put(g, 32, y, 'n'); // ridge
  // outline: any opaque pixel touching transparency
  const opaque = (x: number, y: number) => y >= 0 && y < H && x >= 0 && x < W && g[y][x] !== '.';
  const edges: [number, number][] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (opaque(x, y) && (!opaque(x - 1, y) || !opaque(x + 1, y) || !opaque(x, y - 1) || !opaque(x, y + 1))) edges.push([x, y]);
    }
  }
  for (const [x, y] of edges) put(g, x, y, 'n');
  return fromGrid(key, g);
}

function buildings(): PixelSprite[] {
  return [
    building('bld-coop', { front: 't', side: 'A', roofL: 'R', roofR: 'r', door: 'B', frame: 'w' }),
    building('bld-barn', { front: 'r', side: 'p', roofL: 'e', roofR: 'E', door: 'B', frame: 'w' }),
    building('bld-stable', { front: 'b', side: 'B', roofL: 'a', roofR: 'O', door: 'p', frame: 's' }),
  ];
}

// ---------------------------------------------------------------------------------------------
// Trough 16x8
// ---------------------------------------------------------------------------------------------

function trough(key: string, level: 'empty' | 'low' | 'full'): PixelSprite {
  const inner = level === 'full' ? 'yyyAyyyyAyyy' : level === 'low' ? 'cAAcccccAccc' : 'cccccccccccc';
  return fromRows(key, 16, [
    level === 'full' ? '....yyAyyyAy....' : '',
    '..nnnnnnnnnnnn..',
    `.n${inner}n.`,
    '.nbbbbbbbbbbbbn.',
    '.nbBbbbbbbbbBbn.',
    '..nbbbbbbbbbbn..',
    '..n.n......n.n..',
    '',
  ]);
}

// ---------------------------------------------------------------------------------------------
// Animals 16x16 (facing left)
// ---------------------------------------------------------------------------------------------

const CHICKEN = [
  '', '', '', '',
  '....rr',
  '...ewwe',
  '..oewkwe',
  '...ewwwe.....e',
  '....ewwweeeeewe',
  '....ewwwwwwwwwe',
  '....ewwwwwwwwe',
  '.....ewwwwwwe',
  '......eeeeee',
  '.......o..o',
  '.......o..o',
  '......oo.oo',
];

const CHICK = [
  '', '', '', '', '', '', '', '',
  '.....AA',
  '....AyyA',
  '...oykyyA',
  '....AyyyyAA',
  '....AyyyyyyA',
  '.....AyyyyA',
  '......AAAA',
  '.......o.o',
];

const COW = [
  '', '', '', '',
  '..e..e',
  '..mwwm',
  '.mwkwwmmmmmmmm',
  '.mwwwwwkkwwwwwm',
  '.RRwwwkkkwwkkwm',
  '.RRmwwwwwwwkkwmm',
  '...mwwwkwwwwwwm',
  '...mwwkkwwwwwwm',
  '...mmmmmmmmmmmm',
  '....m.m....m.m',
  '....m.m....m.m',
  '....k.k....k.k',
];

const CALF = [
  '', '', '', '', '', '', '',
  '..e.e',
  '..mwwm',
  '.mwkwmmmmmmm',
  '.RRwwwkkwwwwm',
  '.RRmwwkkwwwwmm',
  '...mwwwwwkwwm',
  '...mmmmmmmmmm',
  '....m.m...m.m',
  '....k.k...k.k',
];

// H = coat, X = mane/outline, h = hooves, k = eye
const HORSE = [
  '', '',
  '...X',
  '..XHX',
  '.HHkHX',
  'HHHHHXX',
  'HH..HHXX',
  '.....HHHHHHHHX',
  '.....HHHHHHHHHXX',
  '.....HHHHHHHHHX',
  '.....HHHHHHHHHX',
  '......HHHHHHHH.X',
  '......H.H...H.H',
  '......H.H...H.H',
  '......H.H...H.H',
  '......h.h...h.h',
];

const FOAL = [
  '', '', '', '', '', '',
  '....X',
  '...XHX',
  '..HkHX',
  '..HHHXX',
  '......HHHHHX',
  '......HHHHHHX',
  '......HHHHH..X',
  '......H.H.H.H',
  '......H.H.H.H',
  '......h.h.h.h',
];

const BREED_COLORS: Record<string, Record<string, string>> = {
  pony: { H: 'b', X: 'B', h: 'n', k: 'k' },
  arabian: { H: 'e', X: 'E', h: 'M', k: 'n' },
  friesian: { H: 'n', X: 'k', h: 'M', k: 'e' },
};

function animals(): PixelSprite[] {
  const out = [
    fromRows('chicken', 16, CHICKEN),
    fromRows('chicken-young', 16, CHICK),
    fromRows('cow', 16, COW),
    fromRows('cow-young', 16, CALF),
  ];
  for (const [breed, map] of Object.entries(BREED_COLORS)) {
    out.push(fromRows(`horse-${breed}`, 16, HORSE, map));
    out.push(fromRows(`foal-${breed}`, 16, FOAL, map));
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------------------------

const TRACTOR = [
  '', '', '',
  '..........nnnnn',
  '..........nPPPn',
  '..........nPPPn',
  '..........nnnnnnnnn',
  '.....nnnnnnrrrrrrrrn',
  '....nrrrrrrrrrrrrrrnn',
  '...nrrrrrrrrrrrrrrrrrn',
  '..nnnnrrrrrrnnnnrrrrrn',
  '.nkkkknrrrrnkkkknrrrrn',
  'nkkMMkknnnnkkMMkknnnn',
  'nkMeeMkn...nkMeeMkn',
  'nkkMMkkn...nkkMMkkn',
  '.nkkkkn.....nkkkkn',
];

const TREE = [
  '......dddd',
  '....ddggggdd',
  '...dgGGggggDd',
  '..dgGGgggggDDd',
  '..dgGggggggDDd',
  '.dggggggggDDDDd',
  '.dgGgggggggDDDd',
  '.dgggggggggDDDd',
  '.ddggggggDDDDdd',
  '..dggggDDDDDdd',
  '...ddDDDDDDdd',
  '.....dddddd',
  '.......Bb',
  '.......Bb',
  '.......Bb',
  '.......Bb',
  '.......Bb',
  '......BBbb',
  '.....BB..bb',
  '',
];

function props(): PixelSprite[] {
  return [
    trough('trough-empty', 'empty'),
    trough('trough-low', 'low'),
    trough('trough-full', 'full'),
    fromRows('tractor', 24, TRACTOR),
    fromRows('tree', 16, TREE),
    fromRows('tree@autumn', 16, TREE, { g: 'o', G: 'y', d: 'A', D: 'r' }),
    fromRows('tree@winter', 16, TREE, { G: 'w', g: 'P', d: 'e', D: 'E' }),
  ];
}

// ---------------------------------------------------------------------------------------------
// Icons 12x12
// ---------------------------------------------------------------------------------------------

const ICONS: Record<string, string[]> = {
  'icon-water': [
    '', '.....uu', '.....uu', '....uLLu', '....uLLu', '...uLCLLu',
    '..uLCLLLLu', '..uLCLLLLu', '..uLLLLLLu', '...uLLLLu', '....uuuu', '',
  ],
  'icon-sick': [
    '', '...eeeeee', '..ewwwwwwe', '.ewwwrrwwwe', '.ewwwrrwwwe', '.ewrrrrrrwe',
    '.ewrrrrrrwe', '.ewwwrrwwwe', '.ewwwrrwwwe', '..ewwwwwwe', '...eeeeee', '',
  ],
  'icon-egg': [
    '', '.....ee', '....ewwe', '...ewwwwe', '...ewwwwe', '..ewwwwwwe',
    '..ewwwwwwe', '..ewwwwwse', '..ewwwwsse', '...ewwsse', '....eeee', '',
  ],
  'icon-milk': [
    '', '....LLLL', '....eeee', '....ewwe', '...ewwwwe', '..ewwwwwwe',
    '..eLLLLLLe', '..ewwwwwwe', '..ewwwwwwe', '..ewwwwwwe', '...eeeeee', '',
  ],
  'icon-heart': [
    '', '', '..rr....rr', '.rRRr..rRRr', '.rRwRrrRRRr', '.rRRRRRRRRr',
    '..rRRRRRRr', '...rRRRRr', '....rRRr', '.....rr', '', '',
  ],
  'icon-hungry': [
    '', '.....y', '....yAy', '.....y.y', '....yAyA', '.....y.y',
    '.....a', '.....a', '.BBBBBBBBBB', '.BbbbbbbbbB', '..BbbbbbbB', '...BBBBBB',
  ],
  'icon-lock': [
    '', '....eeee', '...e....e', '...e....e', '...e....e', '..AAAAAAAA',
    '..AyyyyyyA', '..AyyMMyyA', '..AyyMMyyA', '..AyyyMyyA', '..AyyyyyyA', '..AAAAAAAA',
  ],
};

// UI icons (HUD, toolbar, shop); drawn into DOM images by src/ui/icons.ts
const UI_ICONS: Record<string, string[]> = {
  'icon-coin': [
    '', '...AAAAAA', '..AyyyyyyA', '.AyywwyyyyA', '.AywyyyyyyA', '.AyyyAAyyyA',
    '.AyyyAAyyyA', '.AyyyyyyyyA', '.AyyyyyyyoA', '..AyyyyyoA', '...AAAAAA', '',
  ],
  'icon-star': [
    '', '.....AA', '....AyyA', '....AyyA', 'AAAAyyyyAAAA', '.AyyyyyyyyA',
    '..AyyyyyyA', '...AyyyyA', '..AyyAAyyA', '..AyA..AyA', '.AA......AA', '',
  ],
  'icon-sun': [
    '.....y', '.y...y...y', '..y.ooo.y', '...oyyyo', '..oyyyyyo', 'yyoyyyyyoyy',
    '..oyyyyyo', '...oyyyo', '..y.ooo.y', '.y...y...y', '.....y', '',
  ],
  'icon-rain': [
    '', '....eeee', '..eewwwwe', '.ewwwwwwwe', 'ewwwwwwwwwe', 'eeeeeeeeeee',
    '', '..L..L..L', '.L..L..L', '', '..L..L..L', '.L..L..L',
  ],
  'icon-snow': [
    '', '.....w', '..w..w..w', '...w.w.w', '....www', '.wwwwwwwww',
    '....www', '...w.w.w', '..w..w..w', '.....w', '', '',
  ],
  'icon-hand': [
    '....nn', '...nsn', '...nsnnn', '...nsnsnnn', '.nnnsnsnsn', 'nsnnsssssn',
    'nssnsssssn', '.nssssssssn', '..nsssssssn', '...nssssssn', '....nssssn', '....nnnnnn',
  ],
  'icon-seed': [
    '', '..gg....gg', '.gGGg..gGGg', '.gGGGggGGGg', '..gggggggg', '.....gg',
    '.....gg', '..bbbbbbbb', '.bBBBBBBBBb', '.bBBBBBBBBb', '..bbbbbbbb', '',
  ],
  'icon-sickle': [
    '', '..y.y.y.y', '..yAyAyAy', '...yAyAy', '...AyAyA', '....AAA',
    '....rrr', '....AAA', '...A.A.A', '..A..A..A', '.A...A...A', '',
  ],
  'icon-shop': [
    '', 'rrwwrrwwrrww', 'rrwwrrwwrrww', '.rrwwrrwwrr', '.b........b', '.b.oo.GG..b',
    '.bBBBBBBBBb', '.bttttttttb', '.bttttttttb', '.bBBBBBBBBb', '.b........b', '',
  ],
  'icon-parcel': [
    '', '', '.b...b...b', 'bbbbbbbbbbb', '.b...b...b', '.b...b...b',
    'bbbbbbbbbbb', '.b...b...b', '.b...b...b', 'gggggggggggg', 'GgGgGgGgGgGg', '',
  ],
  'icon-upgrade': [
    '', '.....gg', '....gGGg', '...gGGGGg', '..gGGGGGGg', '.gggGGGGggg',
    '....gGGg', '....gGGg', '....gGGg', '....gGGg', '....gggg', '',
  ],
};

function icons(): PixelSprite[] {
  return [
    ...Object.entries({ ...ICONS, ...UI_ICONS }).map(([key, rows]) => fromRows(key, 12, rows)),
    fromRows('icon-heat', 12, UI_ICONS['icon-sun'], { y: 'o', o: 'r' }),
  ];
}

// ---------------------------------------------------------------------------------------------

export const PLACEHOLDERS: Record<string, PixelSprite> = Object.fromEntries(
  [...tiles(), ...crops(), ...buildings(), ...props(), ...animals(), ...icons()].map((sp) => [sp.key, sp]),
);
