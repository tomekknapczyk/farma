import { describe, expect, it } from 'vitest';
import { validateSprite, type PixelSprite } from '../../src/art/pixelmap';
import { PLACEHOLDERS } from '../../src/art/sprites/placeholders';
import { SPRITES, TEXTURE_KEYS, textureFor } from '../../src/art/registry';
import { PALETTE } from '../../src/art/palette';
import { ROUND1 } from '../../src/art/sprites/round1';
import { ROUND2 } from '../../src/art/sprites/round2';

describe('validateSprite', () => {
  it('reports rows of different length', () => {
    const sp: PixelSprite = { key: 't', palette: { a: '#000000' }, rows: ['aaa', 'aaaa'] };
    expect(validateSprite(sp).length).toBeGreaterThan(0);
  });

  it('reports characters outside the palette', () => {
    const sp: PixelSprite = { key: 't', palette: { a: '#000000' }, rows: ['a.b'] };
    expect(validateSprite(sp).length).toBeGreaterThan(0);
  });

  it('accepts a valid sprite', () => {
    const sp: PixelSprite = { key: 't', palette: { a: '#000000' }, rows: ['a.a', '.a.'] };
    expect(validateSprite(sp)).toEqual([]);
  });
});

describe('placeholders', () => {
  it('every TEXTURE_KEY has a valid placeholder', () => {
    for (const key of TEXTURE_KEYS) {
      const sp = PLACEHOLDERS[key];
      expect(sp, key).toBeDefined();
      expect(sp.key).toBe(key);
      expect(validateSprite(sp), key).toEqual([]);
    }
  });

  it('has the expected sizes', () => {
    const size = (k: string) => [PLACEHOLDERS[k].rows[0].length, PLACEHOLDERS[k].rows.length];
    expect(size('tile-grass')).toEqual([32, 16]);
    expect(size('bld-barn')).toEqual([64, 48]);
    expect(size('chicken')).toEqual([16, 16]);
    expect(size('icon-lock')).toEqual([12, 12]);
  });

  it('textureFor falls back to the base key when no seasonal variant exists', () => {
    expect(textureFor('tile-grass', 'summer')).toBe('tile-grass');
  });

  it('textureFor returns a seasonal variant when one exists', () => {
    expect(textureFor('tile-grass', 'winter')).toBe('tile-grass@winter');
  });

  it('every seasonal variant is valid and has a base key', () => {
    for (const key of Object.keys(PLACEHOLDERS).filter((k) => k.includes('@'))) {
      expect(TEXTURE_KEYS).toContain(key.split('@')[0]);
      expect(validateSprite(PLACEHOLDERS[key]), key).toEqual([]);
    }
  });
});

/**
 * Deliberate size changes against the placeholders. All are bottom-anchored (origin 0.5, 1) and
 * picked by their actual width/height, so farmView needs no per-key maths:
 * - tree: taller round-1 crown;
 * - horses and foals: bigger so they read at zoom 2 (parent's request, round 2); the status icon
 *   follows the sprite height.
 */
const SIZE_OVERRIDES: [RegExp, [number, number]][] = [
  [/^tree$/, [24, 27]],
  [/^horse-/, [24, 20]],
  [/^foal-/, [20, 18]],
];

describe.each([['round 1', ROUND1], ['round 2', ROUND2]] as const)('%s art', (_name, ART) => {
  const size = (sp: { rows: string[] }) => [sp.rows[0].length, sp.rows.length];

  it('every sprite is valid, overrides a known key and uses only palette colours', () => {
    const colours = new Set<string>(Object.values(PALETTE));
    for (const sp of ART) {
      expect(validateSprite(sp), sp.key).toEqual([]);
      expect(TEXTURE_KEYS, sp.key).toContain(sp.key.split('@')[0]);
      for (const row of sp.rows) {
        for (const ch of row) if (ch !== '.') expect(colours.has(sp.palette[ch]), `${sp.key} '${ch}'`).toBe(true);
      }
    }
  });

  it('keeps the placeholder sizes, except the documented overrides', () => {
    for (const sp of ART) {
      const base = sp.key.split('@')[0];
      const override = SIZE_OVERRIDES.find(([re]) => re.test(base));
      if (override) { expect(size(sp), sp.key).toEqual(override[1]); continue; }
      const ph = PLACEHOLDERS[base];
      expect(ph, `${sp.key}: no placeholder to compare with; add a SIZE_OVERRIDES entry`).toBeDefined();
      expect(size(sp), sp.key).toEqual(size(ph));
    }
  });

  it('seasonal variants match their base size', () => {
    for (const sp of ART.filter((s) => s.key.includes('@'))) {
      expect(size(sp), sp.key).toEqual(size(SPRITES[sp.key.split('@')[0]]));
    }
  });

  it('is what the registry serves (unless a later round overrides it)', () => {
    const later = new Set(ART === ROUND1 ? ROUND2.map((sp) => sp.key) : []);
    for (const sp of ART) if (!later.has(sp.key)) expect(SPRITES[sp.key]).toBe(sp);
  });
});

describe('registry after round 2', () => {
  it('serves art for every key and winter variants for outdoor objects', () => {
    for (const key of TEXTURE_KEYS) expect(SPRITES[key], key).toBeDefined();
    expect(textureFor('crop-wheat-3', 'winter')).toBe('crop-wheat-3@winter');
    expect(textureFor('horse-pony', 'winter')).toBe('horse-pony@winter');
    expect(textureFor('bld-coop', 'winter')).toBe('bld-coop@winter');
    const outdoor = [
      'tile-grass', 'tile-locked', 'field-dry', 'field-wet', 'bld-coop', 'bld-barn', 'bld-stable',
      'trough-empty', 'trough-low', 'trough-full', 'chicken', 'chicken-young', 'cow', 'cow-young', 'tree',
      ...['wheat', 'carrot', 'corn', 'pumpkin'].flatMap((c) => [0, 1, 2, 3].map((n) => `crop-${c}-${n}`)),
      ...['pony', 'arabian', 'friesian'].flatMap((b) => [`horse-${b}`, `foal-${b}`]),
    ];
    for (const key of outdoor) expect(textureFor(key, 'winter'), key).toBe(`${key}@winter`);
  });

  it('no placeholder art is left: every placeholder key is overridden by a real art round', () => {
    const real = new Set([...ROUND1, ...ROUND2].map((sp) => sp.key));
    const left = Object.keys(PLACEHOLDERS).filter((k) => !real.has(k));
    expect(left).toEqual([]);
  });
});
