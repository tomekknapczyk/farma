/**
 * Round 2 of the real pixel art: everything round 1 did not cover, in the same style (see the
 * header of round1.ts). Registered after round 1 and overrides the same keys.
 *
 * Sizes equal the placeholders, except the horses (24x20) and foals (20x18), which are bigger so
 * they read at zoom 2; they are bottom-anchored (origin 0.5, 1) like every animal.
 */
import type { PixelSprite } from '../pixelmap';
import { get, grid, inPoly, paint, put, rows, snowCap, sprite, stamp, type Grid, type Mat } from './kit';
import { CHICK, CHICKEN, CLUMPS, details, diamond, TREE, treeWinter } from './round1';

// ---------------------------------------------------------------------------------------------
// Horses 24x20 and foals 20x18, facing left. Mask: H coat, h far legs, M mane/tail, W white
// marking, N muzzle, F hoof, k eye.
// ---------------------------------------------------------------------------------------------

const HORSE_MASK = [
  '........................',
  '......H.H...............',
  '.....HHHHM..............',
  '....HHHHHMM.............',
  '...HkHHHHMMM............',
  '..HHHHHHHHMMM...........',
  '.HHHHHHHHHHMMM..........',
  '.WHHH..HHHHHHMMMHHHHH...',
  '.NNH....HHHHHHHHHHHHHM..',
  '........HSSSHHHHSSHHHMM.',
  '........HSSHHHHHHHHHHMM.',
  '........HHHHHHHHHHHHHMM.',
  '........HHHHHHHHHHHHHMM.',
  '.........HHHHHHHHHHH.MM.',
  '.........HH.hh..HH.hh.M.',
  '.........HH.hh..HH.hh.M.',
  '.........HH.hh..HH.hh...',
  '.........WW.hh..WW.hh...',
  '.........FF.FF..FF.FF...',
  '........................',
];

/** Friesian: long wavy mane down the neck, a long tail and feathered (hairy) feet. */
const FRIESIAN_MASK = [
  '........................',
  '......H.H...............',
  '.....MHHHM..............',
  '....MHHHHMM.............',
  '...HkHHHHMXM............',
  '..HHHHHHHMMXM...........',
  '.HHHHHHHHHMMXM..........',
  '.HHHH..HHHHMMMXMHHHHH...',
  '.NNH....HHHHMMXMHHHHMM..',
  '........HSSSHMXMSSHHHXM.',
  '........HSSHHHMHHHHHHMX.',
  '........HHHHHHHHHHHHHXM.',
  '........HHHHHHHHHHHHHMX.',
  '.........HHHHHHHHHHH.XM.',
  '.........HH.hh..HH.hh.MX',
  '.........HH.hh..HH.hh.XM',
  '.........HH.hh..HH.hh.M.',
  '........MWWMhh.MWWMhh...',
  '.........FF.FF..FF.FF...',
  '........................',
];

const FOAL_MASK = [
  '....................',
  '.....HH.............',
  '....HHHM............',
  '...HkHHMM...........',
  '..HHHHHHMM..........',
  '.WHHHHHHHM..........',
  '.NHH..HHHHMHHHHHM...',
  '......HHHHHHHHHHMM..',
  '.......HHHHHHHHHHM..',
  '.......HHHHHHHHHH...',
  '........HHHHHHHH....',
  '........H.h...H.h...',
  '........H.h...H.h...',
  '........H.h...H.h...',
  '........H.h...H.h...',
  '........W.h...W.h...',
  '........F.F...F.F...',
  '....................',
];

interface Breed { H: Mat; h: Mat; M: Mat; W: Mat | string; N: Mat | string; F: Mat; S: string }

const BREEDS: Record<string, Breed> = {
  // brown pony with a cream mane (as in round 1)
  pony: {
    H: { fill: 'b', light: 't', shade: 'B', line: 'p' },
    h: { fill: 'B', shade: 'p', line: 'p' },
    M: { fill: 's', light: 'w', shade: 't', line: 'b' },
    W: { fill: 'w', line: 'p' },
    N: 'B',
    F: { fill: 'n', line: 'n' },
    S: 't',
  },
  // light grey arabian with a white mane and a dark muzzle
  arabian: {
    H: { fill: 'e', light: 'P', shade: 'E', line: 'm' },
    h: { fill: 'E', shade: 'm', line: 'm' },
    M: { fill: 'w', light: 'w', shade: 'P', line: 'E' },
    W: { fill: 'w', line: 'm' },
    N: 'M',
    F: { fill: 'M', line: 'n' },
    S: 'P',
  },
  // black friesian with a blue sheen and a long mane
  friesian: {
    H: { fill: 'n', light: 'i', shade: 'k', line: 'k' },
    h: { fill: 'k', line: 'k' },
    M: { fill: 'k', light: 'M', line: 'k' },
    W: { fill: 'n', line: 'k' },
    N: 'k',
    F: { fill: 'M', line: 'k' },
    S: 'i',
  },
};

/** Winter: a horse blanket over the barrel (coat pixels in the box become K, the bottom row trim T). */
function blanketMask(mask: string[], top: number, bottom: number, x0: number, x1: number): string[] {
  return mask.map((row, y) => [...row].map((ch, x) => {
    if (y < top || y > bottom || x < x0 || x > x1 || (ch !== 'H' && ch !== 'S')) return ch;
    return y === bottom ? 'T' : 'K';
  }).join(''));
}

const BLANKETS: Record<string, Mat> = {
  pony: { fill: 'r', light: 'R', shade: 'p', line: 'p' },
  arabian: { fill: 'l', light: 'L', shade: 'u', line: 'i' },
  friesian: { fill: 'd', light: 'g', shade: 'D', line: 'c' },
};
const TRIM: Mat = { fill: 's', light: 's', shade: 't', line: 'B' };

function horseSprites(): PixelSprite[] {
  const out: PixelSprite[] = [];
  for (const [breed, b] of Object.entries(BREEDS)) {
    const mats = { ...b, k: breed === 'friesian' ? 'e' : 'k', X: { fill: 'M', line: 'k' }, K: BLANKETS[breed], T: TRIM };
    const adult = breed === 'friesian' ? FRIESIAN_MASK : HORSE_MASK;
    out.push(paint(`horse-${breed}`, 24, adult, mats));
    out.push(paint(`foal-${breed}`, 20, FOAL_MASK, mats));
    out.push(paint(`horse-${breed}@winter`, 24, blanketMask(adult, 7, 12, 10, 19), mats));
    out.push(paint(`foal-${breed}@winter`, 20, blanketMask(FOAL_MASK, 6, 9, 9, 15), mats));
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Cows 16x16 (Holstein: white with black patches, pink muzzle), facing left. Mask: W white,
// B black patch, P pink muzzle, U udder, o horn, E ear, h far legs, F hoof, T tail tuft, k eye.
// Winter: a red scarf (S) round the neck.
// ---------------------------------------------------------------------------------------------

const COW_MASK = [
  '................',
  '................',
  '................',
  '..o...o.........',
  '.EBBWBBE........',
  '..BkWkB.BBWWW...',
  '..WWWWWWBBBWWW..',
  '..PPPPPWWBWWWBT.',
  '.PPkPkPPWWWWBBT.',
  '..PPPPPWWWWWBBT.',
  '....WWWWWWWWWWT.',
  '....WBBWWWUUWW..',
  '.....WWh..UhWW..',
  '.....WWh...hWW..',
  '.....FFF...FFF..',
  '................',
];

const CALF_MASK = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '.EBWWBE.........',
  '..BkWk.BWWW.....',
  '..WWWWWBBWWW....',
  '..PPPPWWWWBWT...',
  '.PkPPkPWWWWWT...',
  '..PPPP.WWWWW....',
  '.....WWWWBWW....',
  '.....Wh..hW.....',
  '.....Wh..hW.....',
  '.....FF..FF.....',
  '................',
];

const COW_MATS: Record<string, Mat | string> = {
  W: { fill: 'w', shade: 'P', line: 'E' },
  B: { fill: 'n', light: 'M', line: 'k' },
  P: { fill: 'q', light: 's', shade: 'R', line: 'v' },
  U: { fill: 'q', shade: 'R', line: 'v' },
  o: { fill: 's', light: 'w', line: 'E' },
  E: { fill: 'e', line: 'E' },
  h: { fill: 'e', shade: 'E', line: 'E' },
  F: { fill: 'M', line: 'n' },
  T: { fill: 'n', line: 'k' },
  S: { fill: 'r', light: 'R', shade: 'p', line: 'p' },
  k: 'k',
};

/** Winter scarf: neck pixels in rows top..bottom at columns x0..x1, plus a hanging end. */
function scarfMask(mask: string[], cells: [number, number][]): string[] {
  const out = mask.map((r) => [...r]);
  for (const [x, y] of cells) out[y][x] = 'S';
  return out.map((r) => r.join(''));
}

function cowSprites(): PixelSprite[] {
  return [
    paint('cow', 16, COW_MASK, COW_MATS),
    paint('cow-young', 16, CALF_MASK, COW_MATS),
    paint('cow@winter', 16, scarfMask(COW_MASK, [[7, 5], [7, 6], [8, 6], [7, 7], [8, 7], [7, 8], [7, 9], [7, 10]]), COW_MATS),
    paint('cow-young@winter', 16, scarfMask(CALF_MASK, [[6, 6], [6, 7], [7, 7], [6, 8], [6, 9], [6, 10]]), COW_MATS),
  ];
}

// ---------------------------------------------------------------------------------------------
// Chicken and chick winter variants: a small blue scarf for the hen, a snow cap for the chick.
// ---------------------------------------------------------------------------------------------

function edit(src: string[], cells: [number, number, string][]): string[] {
  const out = src.map((r) => [...r.padEnd(16, '.')]);
  for (const [x, y, ch] of cells) out[y][x] = ch;
  return out.map((r) => r.join(''));
}

function chickenSprites(): PixelSprite[] {
  const hen = edit(CHICKEN, [
    [3, 8, 'L'], [4, 8, 'L'], [5, 8, 'L'], [6, 8, 'L'], [7, 8, 'u'],
    [3, 9, 'l'], [4, 9, 'l'], [5, 9, 'l'], [6, 9, 'l'], [7, 9, 'u'],
    [4, 10, 'l'], [4, 11, 'u'],
  ]);
  const chick = edit(CHICK, [[6, 7, 'E'], [7, 7, 'E'], [8, 7, 'E'], [6, 8, 'w'], [7, 8, 'w'], [8, 8, 'w'], [9, 8, 'P']]);
  return [rows('chicken@winter', 16, hen), rows('chicken-young@winter', 16, chick)];
}

// ---------------------------------------------------------------------------------------------
// Crops 32x24 (bottom = tile bottom). Stamps are bottom-centre anchored; `@winter` puts a white
// tip on the top pixel of every column, as for the wheat.
// ---------------------------------------------------------------------------------------------

// carrot: feathery dark-green tops; ripe = orange shoulders showing above the soil
const CARROT: string[][] = [
  ['G.G', '.g.'],
  ['G.G.G', '.GgG.', '..g..'],
  [
    '.G...G.',
    'GgG.GgG',
    '.gGgGg.',
    'G.gDg.G',
    '.ggDgg.',
    '...D...',
  ],
  [
    '.G.G.G',
    '.gGgGg',
    '..gDg.',
    '.BsooB',
    '.BsooB',
    '..BorB',
    '..BoB.',
    '...B..',
  ],
];

// corn: tall stalks with long leaves; ripe = yellow cobs in green husks and tan tassels
const CORN: string[][] = [
  ['.G.', 'G.g', '.g.'],
  [
    '...G...',
    '.G.g..G',
    '..Gg.G.',
    'G..gG..',
    '.GgD...',
    '...D...',
  ],
  [
    '....a...',
    '...aGa..',
    '....gD..',
    '.G..gD..',
    'GgG.gD.G',
    '...ggDGg',
    '..G.gD..',
    '.GggGD..',
    'G...gDG.',
    '....gDgG',
    '....gD..',
    '.....D..',
  ],
  [
    '....t...',
    '...tAt..',
    '..t.g.t.',
    '....gD..',
    '.G..gD..',
    'GgG.gD.G',
    '.AA.gDGg',
    'AwyAgD..',
    'AyyAgD..',
    'AyyAgDG.',
    'AytAgDgG',
    '.AygggD.',
    '..gg.gD.',
    '.g...gD.',
    '.....D..',
  ],
];
// stalks back to front: [cx, bottom y]
const CORN_SPOTS: [number, number][] = [[12, 15], [20, 15], [7, 19], [16, 19], [25, 19], [11, 22], [21, 22]];

// pumpkin: round leaves on a vine; ripe = big ribbed orange pumpkins
const PUMPKIN: string[][] = [
  ['GG.GG', '.gDg.', '..D..'],
  [
    '.GG..GG.',
    'GggGGggG',
    '.gDggDg.',
    '..D..D..',
  ],
  [
    '.GG...GG.',
    'GggG.GggG',
    'gDgOOOgDg',
    '.DOGaaOD.',
    '..OaaaO..',
    '...OOO...',
  ],
  [
    '....D....',
    '..BBDBB..',
    '.BysoroB.',
    'BysoorooB',
    'BsooroorB',
    'BoooroorB',
    '.BoorrrB.',
    '..BBBBB..',
  ],
];
// leaves that stay around the ripe pumpkins
const PUMPKIN_LEAF = ['.GG.', 'GggG', 'gDgD', '.DD.'];
const PUMPKIN_SPOTS: [number, number][] = [[16, 13], [8, 17], [24, 17], [16, 21]];

function crop(name: string, stage: number, stamps: string[][], spots: [number, number][], winter: boolean): PixelSprite {
  const g = grid(32, 24);
  const snow = (src: string[]) => (winter && stage > 0 ? snowCap(src, 'w', '') : src);
  if (name === 'pumpkin' && stage === 3) {
    for (const [cx, by] of [[12, 12], [21, 13], [4, 17], [28, 17], [11, 21], [21, 21]] as [number, number][]) stamp(g, cx, by, snow(PUMPKIN_LEAF));
  }
  for (const [cx, by] of spots) {
    put(g, cx + 1, by + 1, 'p'); // small shadow at the base (light from the top-left)
    stamp(g, cx, by, snow(stamps[stage]));
  }
  return sprite(`crop-${name}-${stage}${winter ? '@winter' : ''}`, g);
}

function cropSprites(): PixelSprite[] {
  const kinds: [string, string[][], [number, number][]][] = [
    ['carrot', CARROT, CLUMPS],
    ['corn', CORN, CORN_SPOTS],
    ['pumpkin', PUMPKIN, PUMPKIN_SPOTS],
  ];
  return kinds.flatMap(([name, stamps, spots]) =>
    [0, 1, 2, 3].flatMap((n) => [crop(name, n, stamps, spots, false), crop(name, n, stamps, spots, true)]));
}

// ---------------------------------------------------------------------------------------------
// Barn and stable 64x48, built like the round-1 coop: a gable end on the lit front-left wall,
// a roof over the shaded right wall, outline in a darker shade of each material.
// ---------------------------------------------------------------------------------------------

const lowerL = (x: number): number => 32 + Math.floor((x - 4) / 2); // front-left wall bottom, x 4..31
const lowerR = (x: number): number => 46 - Math.floor((x - 32) / 2); // right wall bottom, x 32..60
const APEX_X = 18;
const RIDGE: [number, number] = [29, -15]; // ridge direction, along the building depth

interface RoofLook { face: string; line: string; ridge: string; trim: string; under: string; outline: string; plane2?: string }

interface BuildingSpec {
  wallH: number;
  /** Gable height above the wall top at distance d (0..14) from the apex column. */
  gable: (d: number) => number;
  /** Knee of a gambrel roof (distance from the apex), or null for a plain gable. */
  knee: number | null;
  front: (x: number, k: number) => string; // k = height above the ground line
  side: (x: number, k: number) => string;
  wallOutline: string;
  details: (d: Details) => void;
}

/** Helpers that place stamps on the walls, sheared to follow the iso slope of the wall. */
interface Details {
  g: Grid;
  /** Stamp on the front wall; its bottom row sits `lift` px above the ground at every column. */
  front: (x0: number, lift: number, src: string[]) => void;
  side: (x0: number, lift: number, src: string[]) => void;
  apexY: number;
}

function shear(g: Grid, lower: (x: number) => number, x0: number, lift: number, src: string[]): void {
  src.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) {
      if (row[dx] === '.') continue;
      const x = x0 + dx;
      put(g, x, lower(x) - lift - (src.length - 1 - dy), row[dx]);
    }
  });
}

function building(key: string, spec: BuildingSpec, roof: RoofLook, winter: boolean): PixelSprite {
  const W = 64;
  const H = 48;
  const g = grid(W, H);
  const mat = grid(W, H); // 'w' wall, 'r' roof: picks the outline colour
  const wall = (x: number, y: number, ch: string) => { put(g, x, y, ch); put(mat, x, y, 'w'); };
  const top = (x: number) => Math.ceil(lowerL(x) - spec.wallH - spec.gable(Math.abs(x - APEX_X)));

  for (let x = 4; x <= 31; x++) for (let y = top(x); y <= lowerL(x); y++) wall(x, y, spec.front(x, lowerL(x) - y));
  for (let x = 32; x <= 60; x++) for (let y = lowerR(x) - spec.wallH; y <= lowerR(x); y++) wall(x, y, spec.side(x, lowerR(x) - y));

  const apexY = top(APEX_X);
  spec.details({
    g,
    front: (x0, lift, src) => shear(g, lowerL, x0, lift, src),
    side: (x0, lift, src) => shear(g, lowerR, x0, lift, src),
    apexY,
  });

  // roof over the right wall: one plane (gable) or two (gambrel: shallow upper, steep lower)
  const A: [number, number] = [APEX_X - 1, apexY - 1];
  const Rb: [number, number] = [A[0] + RIDGE[0], A[1] + RIDGE[1]];
  const E1: [number, number] = [33, lowerR(32) - spec.wallH + 3];
  const E2: [number, number] = [63, lowerR(60) - spec.wallH + 2];
  const planes: { poly: [number, number][]; face: string }[] = [];
  if (spec.knee === null) {
    planes.push({ poly: [A, Rb, E2, E1], face: roof.face });
  } else {
    const kx = APEX_X + spec.knee + 1;
    const K1: [number, number] = [kx, top(kx - 1) - 1];
    const K2: [number, number] = [K1[0] + RIDGE[0], K1[1] + RIDGE[1]];
    planes.push({ poly: [A, Rb, K2, K1], face: roof.face });
    planes.push({ poly: [K1, K2, E2, E1], face: roof.plane2 ?? roof.face });
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const plane = planes.find((p) => inPoly(x, y, p.poly));
      if (!plane) continue;
      const d = y + Math.floor(x / 2); // shingle rows parallel to the eave
      const row = Math.floor(d / 3);
      let ch = d % 3 === 0 ? roof.line : plane.face;
      if (d % 3 !== 0 && (x + row * 3) % 6 === 0) ch = roof.line; // staggered joints
      put(g, x, y, ch);
      put(mat, x, y, 'r');
    }
  }
  // ridge cap (lit) and the front rake trim
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (get(mat, x, y) !== 'r') continue;
      if (get(mat, x, y - 1) !== 'r' && x <= Rb[0]) put(g, x, y, roof.ridge);
      else if (get(mat, x - 1, y) !== 'r') put(g, x, y, roof.trim);
    }
  }
  // barge board along the left rake of the gable (edge of the hidden back slope)
  for (let x = 4; x <= APEX_X; x++) {
    let y = 0;
    while (y < H && get(mat, x, y) !== 'w') y++;
    put(g, x, y - 1, roof.trim); put(mat, x, y - 1, 'r');
    put(g, x, y, roof.under); put(mat, x, y, 'r');
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
  // outline: opaque pixels touching transparency, in the darker shade of their material
  const opaque = (x: number, y: number) => get(g, x, y) !== '.';
  const edges: [number, number][] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (opaque(x, y) && (!opaque(x - 1, y) || !opaque(x + 1, y) || !opaque(x, y - 1) || !opaque(x, y + 1))) edges.push([x, y]);
    }
  }
  for (const [x, y] of edges) put(g, x, y, get(mat, x, y) === 'r' ? roof.outline : spec.wallOutline);
  return sprite(key, g);
}

const SNOW_ROOF: RoofLook = { face: 'w', plane2: 'w', line: 'P', ridge: 'w', trim: 'w', under: 'P', outline: 'E' };

/** Double door with a frame, a centre post and an X brace on each leaf. */
function barnDoor(w: number, h: number, frame: string, leaf: string, brace: string): string[] {
  const out: string[] = [];
  const mid = Math.floor(w / 2);
  for (let y = 0; y < h; y++) {
    let row = '';
    for (let x = 0; x < w; x++) {
      if (y === 0 || x === 0 || x === w - 1 || x === mid) { row += frame; continue; }
      const lx = x < mid ? x - 1 : x - mid - 1;
      const lw = mid - 1;
      const t = Math.round(((y - 1) * (lw - 1)) / (h - 2));
      row += lx === t || lx === lw - 1 - t ? brace : leaf;
    }
    out.push(row);
  }
  return out;
}

// --- barn: red boards, white trim and X doors, gambrel roof in grey slate
const BARN: BuildingSpec = {
  wallH: 10,
  gable: (d) => (d <= 7 ? 13 - (d * 5) / 7 : Math.max(0, 8 - ((d - 7) * 8) / 7)),
  knee: 7,
  front: (x, k) => (k <= 1 ? (x % 3 === 0 ? 'E' : 'e') : x === 31 ? 'w' : x % 4 === 0 ? 'r' : 'R'),
  side: (x, k) => (k <= 1 ? (x % 3 === 0 ? 'm' : 'E') : x === 32 ? 'e' : k % 3 === 0 ? 'p' : 'r'),
  wallOutline: 'p',
  details: ({ front, side }) => {
    front(12, 2, barnDoor(13, 9, 'w', 'r', 'w'));
    // hayloft door with hay peeking out, in the gable
    front(16, 12, ['wwwww', 'wnnnw', 'wnAnw', 'wyyyw', 'wwwww']);
    // side window with a white cross frame
    side(44, 4, ['wwwwwww', 'wuuwLuw', 'wwwwwww', 'wuuwuuw', 'wwwwwww']);
  },
};
const BARN_ROOF: RoofLook = { face: 'e', plane2: 'E', line: 'm', ridge: 'w', trim: 'w', under: 'e', outline: 'M' };

// --- stable: brown wood, Dutch stall doors with horses looking out, green roof, horseshoe
const STABLE: BuildingSpec = {
  wallH: 13,
  gable: (d) => Math.max(0, 9 - (d * 9) / 14),
  knee: null,
  front: (x, k) => (k <= 1 ? 'B' : x === 31 ? 's' : x % 4 === 0 ? 'B' : x % 4 === 1 ? 't' : 'b'),
  side: (x, k) => (k <= 1 ? 'p' : x === 32 ? 'b' : k % 3 === 0 ? 'p' : 'B'),
  wallOutline: 'p',
  details: ({ front, side, g, apexY }) => {
    // wide arched entrance, dark inside, with a hay bale
    front(12, 1, [
      '..sssssss..',
      '.ssnnnnnss.',
      'ssnnnnnnnss',
      'snnnnnnnnns',
      'snnnnnnnnns',
      'snnnnnnnnns',
      'snnnnnnyyAs',
      'snnnnnnytAs',
      'snnnnnnAAAs',
    ]);
    // lucky horseshoe in the gable
    ['EE.EE', 'eE.eE', 'eE.eE', 'eEEeE', '.eee.'].forEach((row, dy) => [...row].forEach((ch, dx) => {
      if (ch !== '.') put(g, APEX_X - 2 + dx, apexY + 3 + dy, ch);
    }));
    // two Dutch stall doors: open top half with a horse head, closed bottom half with a brace
    const stall = (head: string, mane: string): string[] => [
      'sssssss',
      'snnnnns',
      `sn${mane}${head}nns`,
      `s${head}${head}${head}nns`,
      `s${head}k${head}nns`,
      'sssssss',
      'sbtbtbs',
      'stBbBts',
      'sssssss',
    ];
    side(37, 1, stall('b', 's'));
    side(49, 1, stall('e', 'w'));
  },
};
const STABLE_ROOF: RoofLook = { face: 'd', line: 'D', ridge: 'G', trim: 'g', under: 'D', outline: 'c' };

function barnSprites(): PixelSprite[] {
  return [
    building('bld-barn', BARN, BARN_ROOF, false),
    building('bld-barn@winter', BARN, SNOW_ROOF, true),
    building('bld-stable', STABLE, STABLE_ROOF, false),
    building('bld-stable@winter', STABLE, SNOW_ROOF, true),
  ];
}

// ---------------------------------------------------------------------------------------------
// Troughs 16x8: wooden box, lit rim, feed inside. `@winter`: snow on the rim (and the hay).
// ---------------------------------------------------------------------------------------------

const TROUGH_BODY = [
  '.ptttttttttttbp.',
  '.pbbBbbbbbbBbbp.',
  '..pBBBBBBBBBBp..',
  '..pp........pp..',
];
const TROUGHS: Record<string, string[]> = {
  empty: ['................', '..pppppppppppp..', '.pssssssssssssp.', '.pBnnnnnnnnnnBp.', ...TROUGH_BODY],
  low: ['................', '..pppppppppppp..', '.pssssssssssssp.', '.pBnAynnnAtynBp.', ...TROUGH_BODY],
  full: ['...AyytyyAyty...', '..AyyyyyyyyytA..', '.psyytyyyyAyysp.', '.pBAyyAyyyytABp.', ...TROUGH_BODY],
};

function troughSprites(): PixelSprite[] {
  return Object.entries(TROUGHS).flatMap(([level, src]) => [
    rows(`trough-${level}`, 16, src),
    rows(`trough-${level}@winter`, 16, snowCap(src, 'w', '')),
  ]);
}

// ---------------------------------------------------------------------------------------------
// Tractor 24x16 (toolbar icon), facing left: red body, cab with a window, big rear wheel.
// ---------------------------------------------------------------------------------------------

function tractorSprite(): PixelSprite {
  const m = Array.from({ length: 16 }, () => new Array<string>(24).fill('.'));
  const fill = (x0: number, y0: number, x1: number, y1: number, ch: string) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m[y][x] = ch;
  };
  const disc = (cx: number, cy: number, r: number, ch: string) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 24; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) m[y][x] = ch;
  };
  fill(12, 1, 19, 9, 'R'); // cab
  fill(13, 2, 18, 5, 'C'); // window
  fill(2, 6, 13, 10, 'R'); // hood
  fill(2, 7, 2, 9, 'Q'); // grille
  fill(5, 2, 5, 5, 'X'); // exhaust pipe
  fill(11, 11, 20, 11, 'R');
  disc(16, 10.5, 4.3, 'K'); // rear wheel
  disc(16, 10.5, 1.5, 'Y');
  disc(5, 12, 2.4, 'K'); // front wheel
  m[12][5] = 'Y';
  return paint('tractor', 24, m.map((r) => r.join('')), {
    R: { fill: 'r', light: 'R', shade: 'p', line: 'p' },
    C: { fill: 'C', light: 'P', line: 'u' },
    Q: { fill: 'e', line: 'm' },
    X: { fill: 'M', light: 'e', line: 'n' },
    K: { fill: 'n', light: 'M', line: 'k' },
    Y: { fill: 'y', shade: 'A' },
  });
}

// ---------------------------------------------------------------------------------------------
// Tiles: locked land (wild dark meadow; winter = grey snow with weeds poking out), autumn grass.
// Tree in autumn: the round-1 crown recoloured orange, with fallen leaves at the roots.
// ---------------------------------------------------------------------------------------------

const WEEDS: [number, number, string[]][] = [
  [13, 2, ['a.a', 'O.O', '.O.']], [6, 6, ['a.a', 'O.O', '.O.']], [21, 5, ['a', 'O']], [16, 8, ['a.a', 'O.O', '.O.']],
  [25, 8, ['a', 'O']], [9, 10, ['a', 'O']], [19, 11, ['a.a', 'O.O', '.O.']], [11, 6, ['c']], [23, 10, ['c']], [15, 12, ['c']],
];
const WEEDS_WINTER: [number, number, string[]][] = [
  [13, 2, ['E.E', 'm.m']], [6, 6, ['m']], [21, 5, ['ww', 'PP']], [16, 8, ['E.E', 'm.m']], [25, 8, ['m']],
  [9, 10, ['ww', 'PP']], [19, 11, ['E', 'm']], [11, 7, ['P']], [23, 10, ['P']],
];
const AUTUMN_DETAILS: [number, number, string[]][] = [
  [13, 2, ['t.t', 'A.A', '.A.']], [6, 6, ['t.t', 'A.A', '.A.']], [21, 5, ['o']], [16, 8, ['t.t', 'A.A', '.A.']],
  [25, 8, ['r']], [9, 10, ['y']], [19, 11, ['t.t', 'A.A', '.A.']], [27, 6, ['o']], [11, 6, ['r']], [23, 10, ['o']],
  [13, 12, ['y']], [17, 4, ['o']],
];

function tileSprites(): PixelSprite[] {
  return [
    diamond('tile-locked', (_x, _y, e) => (e === 'tl' || e === 'tr' ? 'a' : e ? 'c' : 'D'), (g) => details(g, WEEDS)),
    diamond('tile-locked@winter', (_x, _y, e) => (e === 'tl' || e === 'tr' ? 'P' : e ? 'E' : 'e'), (g) => details(g, WEEDS_WINTER)),
    diamond('tile-grass@autumn', (_x, _y, e) => (e === 'tl' || e === 'tr' ? 't' : e ? 'O' : 'a'), (g) => details(g, AUTUMN_DETAILS)),
    rows('tree@autumn', 24, TREE, { G: 'y', g: 'o', D: 'r', c: 'p' }),
    // winter: the whole crown frosted white (round 1 kept green leaves, which read as grey in game)
    rows('tree@winter', 24, treeWinter(TREE), { G: 'w', g: 'w', D: 'P', c: 'E' }),
  ];
}

// ---------------------------------------------------------------------------------------------
// Icons 12x12: map status icons and UI icons, painted from masks (outline added outside).
// ---------------------------------------------------------------------------------------------

const GOLD: Mat = { fill: 'y', shade: 't', line: 'A' };
const WHITE: Mat = { fill: 'w', shade: 'P', line: 'E' };
const ICONS: [string, string[], Record<string, Mat | string>][] = [
  ['icon-water', [
    '............',
    '.....LL.....',
    '....LLLL....',
    '....LLLL....',
    '...LLLLLL...',
    '..LwLLLLLL..',
    '..LwLLLLLL..',
    '..LLLLLLLL..',
    '..LLLLLLLL..',
    '...LLLLLL...',
    '....LLLL....',
    '............',
  ], { L: { fill: 'L', light: 'C', shade: 'l', line: 'u' }, w: 'w' }],
  ['icon-sick', [
    '............',
    '....WWWW....',
    '..WWWWWWWW..',
    '..WWWRRWWW..',
    '.WWWWRRWWWW.',
    '.WWRRRRRRWW.',
    '.WWRRRRRRWW.',
    '.WWWWRRWWWW.',
    '..WWWRRWWW..',
    '..WWWWWWWW..',
    '....WWWW....',
    '............',
  ], { W: WHITE, R: 'r' }],
  ['icon-egg', [
    '............',
    '.....EE.....',
    '....EEEE....',
    '...EEEEEE...',
    '...EwEEEE...',
    '..EEwEEEEE..',
    '..EEEEEEEE..',
    '..EEEEEEEE..',
    '..EEEEEEEE..',
    '...EEEEEE...',
    '....EEEE....',
    '............',
  ], { E: { fill: 'w', shade: 's', line: 't' }, w: 'w' }],
  ['icon-milk', [
    '............',
    '....CCCC....',
    '....WWWW....',
    '....WWWW....',
    '...WWWWWW...',
    '..WWWWWWWW..',
    '..WLLLLLLW..',
    '..WLwLLLLW..',
    '..WLLLLLLW..',
    '..WWWWWWWW..',
    '..WWWWWWWW..',
    '............',
  ], { C: { fill: 'l', light: 'L', line: 'u' }, W: WHITE, L: 'L', w: 'w' }],
  ['icon-heart', [
    '............',
    '............',
    '..HHH..HHH..',
    '.HHwHHHHHHH.',
    '.HwHHHHHHHH.',
    '.HHHHHHHHHH.',
    '..HHHHHHHH..',
    '...HHHHHH...',
    '....HHHH....',
    '.....HH.....',
    '............',
    '............',
  ], { H: { fill: 'R', shade: 'r', line: 'p' }, w: 'w' }],
  ['icon-hungry', [
    '............',
    '............',
    '............',
    '....YYYY....',
    '...YYAYYY...',
    '..YYYYYAYY..',
    '.BBBBBBBBBB.',
    '.BBBBBBBBBB.',
    '..BBBBBBBB..',
    '...BBBBBB...',
    '............',
    '............',
  ], { Y: { fill: 'y', light: 'w', shade: 't', line: 'A' }, A: 'A', B: { fill: 'b', light: 't', shade: 'B', line: 'p' } }],
  ['icon-lock', [
    '............',
    '....SSSS....',
    '...SS..SS...',
    '...S....S...',
    '...S....S...',
    '..YYYYYYYY..',
    '..YYYYYYYY..',
    '..YYYkkYYY..',
    '..YYYkkYYY..',
    '..YYYYkYYY..',
    '..YYYYYYYY..',
    '............',
  ], { S: { fill: 'e', light: 'w', shade: 'E', line: 'm' }, Y: { fill: 'y', light: 'w', shade: 't', line: 'A' }, k: 'p' }],
  ['icon-coin', [
    '............',
    '....YYYY....',
    '..YYYYYYYY..',
    '..YwttttYY..',
    '.YYtYYYYtYY.',
    '.YYtYYYYtYY.',
    '.YYtYYYYtYY.',
    '.YYtYYYYtYY.',
    '..YYttttYY..',
    '..YYYYYYYY..',
    '....YYYY....',
    '............',
  ], { Y: GOLD, t: 't', w: 'w' }],
  ['icon-star', [
    '............',
    '.....YY.....',
    '.....YY.....',
    '....YwYY....',
    '.YYYYwYYYYY.',
    '..YYYYYYYY..',
    '...YYYYYY...',
    '...YYYYYY...',
    '..YYY..YYY..',
    '..YY....YY..',
    '............',
    '............',
  ], { Y: GOLD, w: 'w' }],
  ['icon-sun', SUN_MASK(), { Y: { fill: 'y', light: 'w', shade: 't', line: 'o' }, o: 'o' }],
  ['icon-heat', SUN_MASK(), { Y: { fill: 'o', light: 'y', shade: 'r', line: 'r' }, o: 'r' }],
  ['icon-rain', [
    '............',
    '....WWW.....',
    '..WWWWWWW...',
    '.WWWWWWWWW..',
    '.WWWWWWWWWW.',
    '..WWWWWWWW..',
    '............',
    '..l..l..l...',
    '.l..l..l....',
    '............',
    '...l..l..l..',
    '..l..l..l...',
  ], { W: WHITE, l: 'l' }],
  ['icon-snow', [
    '............',
    '.....S......',
    '..S..S..S...',
    '...S.S.S....',
    '....SSS.....',
    '.SSSSSSSSS..',
    '....SSS.....',
    '...S.S.S....',
    '..S..S..S...',
    '.....S......',
    '............',
    '............',
  ], { S: { fill: 'w', line: 'L' } }],
  ['icon-hand', [
    '............',
    '....SS......',
    '....SS......',
    '....SS......',
    '....SStStS..',
    '.SS.SStStSS.',
    '.SSSSSSSSSS.',
    '..SSSSSSSSS.',
    '..SSSSSSSSS.',
    '...SSSSSSS..',
    '....CCCCC...',
    '............',
  ], { S: { fill: 's', light: 'w', shade: 't', line: 'b' }, t: 't', C: { fill: 'L', shade: 'l', line: 'u' } }],
  ['icon-seed', [
    '............',
    '..LL...LL...',
    '.LLLL.LLLL..',
    '.LLLLLLLLL..',
    '...LLSLL....',
    '.....S......',
    '.....S......',
    '..BBBBBBB...',
    '.BBBBBBBBB..',
    '.BBBBBBBBB..',
    '............',
    '............',
  ], { L: { fill: 'g', light: 'G', shade: 'D', line: 'c' }, S: { fill: 'g', line: 'c' }, B: { fill: 'b', light: 't', shade: 'B', line: 'p' } }],
  ['icon-sickle', [
    '............',
    '....EEEEE...',
    '..EEEEEEEE..',
    '.EEE....EE..',
    '.EE......E..',
    '.EE.........',
    '.EEE........',
    '..EEEE.HH...',
    '....EEHHH...',
    '.......HHH..',
    '........HH..',
    '............',
  ], { E: { fill: 'e', light: 'w', shade: 'E', line: 'm' }, H: { fill: 'b', light: 't', shade: 'B', line: 'p' } }],
  ['icon-shop', [
    '............',
    '.RRwwRRwwRR.',
    '.RRwwRRwwRR.',
    '..RwwRRwwR..',
    '..P......P..',
    '..P.oyGr.P..',
    '.TTTTTTTTTT.',
    '.TBBBBBBBBT.',
    '.TBBBBBBBBT.',
    '.TTTTTTTTTT.',
    '............',
    '............',
  ], {
    R: { fill: 'r', light: 'R', line: 'p' }, w: { fill: 'w', shade: 'P', line: 'p' }, P: { fill: 'b', line: 'p' },
    T: { fill: 't', light: 's', shade: 'b', line: 'p' }, B: 'B', o: 'o', y: 'y', G: 'g', r: 'r',
  }],
  ['icon-parcel', [
    '............',
    '............',
    '..P...P...P.',
    '.PPPPPPPPPP.',
    '..P...P...P.',
    '.PPPPPPPPPP.',
    '..P...P...P.',
    '..P...P...P.',
    '.GGGGGGGGGG.',
    '.GGGGGGGGGG.',
    '............',
    '............',
  ], { P: { fill: 't', light: 's', shade: 'b', line: 'p' }, G: { fill: 'g', light: 'G', shade: 'D', line: 'c' } }],
  ['icon-upgrade', [
    '............',
    '.....AA.....',
    '....AAAA....',
    '...AAAAAA...',
    '..AAAAAAAA..',
    '.AAAAAAAAAA.',
    '....AAAA....',
    '....AAAA....',
    '....AAAA....',
    '....AAAA....',
    '............',
    '............',
  ], { A: { fill: 'g', light: 'G', shade: 'D', line: 'c' } }],
];

function SUN_MASK(): string[] {
  return [
    '.....oo.....',
    '.o...oo...o.',
    '..o......o..',
    '....YYYY....',
    '...YYYYYY...',
    'oo.YYYYYY.oo',
    'oo.YYYYYY.oo',
    '...YYYYYY...',
    '....YYYY....',
    '..o......o..',
    '.o...oo...o.',
    '.....oo.....',
  ];
}

function iconSprites(): PixelSprite[] {
  return ICONS.map(([key, mask, mats]) => paint(key, 12, mask, mats));
}

// ---------------------------------------------------------------------------------------------

export const ROUND2: PixelSprite[] = [
  ...horseSprites(),
  ...cowSprites(),
  ...chickenSprites(),
  ...cropSprites(),
  ...barnSprites(),
  ...troughSprites(),
  tractorSprite(),
  ...tileSprites(),
  ...iconSprites(),
];
