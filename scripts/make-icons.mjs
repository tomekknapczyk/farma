// Generates the PWA icons: a red barn on grass, built as a 32x32 pixel map and scaled
// (nearest neighbour) with pngjs. Run: node scripts/make-icons.mjs
import { PNG } from 'pngjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const N = 32;
const COL = {
  g: '#6abe30', G: '#99e550', D: '#4b692f', // grass base / light / dark
  n: '#222034', r: '#ac3232', R: '#d95763', // outline, barn red, red highlight
  w: '#ffffff', b: '#663931', B: '#8f563b', y: '#fbf236', // trim, door, roof, hay
};
const grid = Array.from({ length: N }, () => Array(N).fill('g'));
const rect = (x, y, w, h, c) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) grid[j][i] = c; };

// grass speckles (kept in the outer ring, safe under a maskable crop)
for (const [x, y, c] of [[2, 3, 'G'], [27, 5, 'D'], [5, 27, 'D'], [24, 28, 'G'], [29, 22, 'G'], [3, 14, 'D'], [13, 29, 'G'], [20, 2, 'G']]) grid[y][x] = c;

// barn body, roof, door (central ~60%)
rect(6, 14, 20, 12, 'n'); rect(7, 15, 18, 10, 'r'); rect(7, 15, 18, 1, 'R');
for (let k = 0; k < 7; k++) { // gambrel-ish roof rows, widest at the bottom
  const w = 20 - 2 * (6 - k);
  rect(16 - w / 2 - 1, 7 + k, w + 2, 1, 'n');
  rect(16 - w / 2, 7 + k, w, 1, 'B');
}
rect(5, 13, 22, 1, 'n'); rect(6, 13, 20, 1, 'B');
rect(12, 17, 8, 9, 'n'); rect(13, 18, 6, 8, 'b'); // door
rect(13, 18, 6, 1, 'w'); rect(13, 18, 1, 8, 'w'); rect(18, 18, 1, 8, 'w'); // door trim
for (let k = 0; k < 6; k++) { grid[18 + k][13 + k] = 'w'; grid[18 + k][18 - k] = 'w'; } // cross brace
rect(14, 10, 4, 2, 'n'); rect(15, 10, 2, 2, 'y'); // hay window
rect(4, 26, 24, 1, 'D');

function render(size) {
  const png = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const hex = COL[grid[Math.floor((y * N) / size)][Math.floor((x * N) / size)]];
      const i = (y * size + x) * 4;
      png.data[i] = parseInt(hex.slice(1, 3), 16);
      png.data[i + 1] = parseInt(hex.slice(3, 5), 16);
      png.data[i + 2] = parseInt(hex.slice(5, 7), 16);
      png.data[i + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(out, { recursive: true });
for (const [name, size] of [['icon-192', 192], ['icon-512', 512], ['apple-touch-icon', 180]]) {
  writeFileSync(join(out, `${name}.png`), render(size));
  console.log(`${name}.png ${size}x${size}`);
}
