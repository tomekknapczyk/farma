import { describe, expect, it } from 'vitest';
import { validateSprite, type PixelSprite } from '../../src/art/pixelmap';
import { PLACEHOLDERS } from '../../src/art/sprites/placeholders';
import { SPRITES, TEXTURE_KEYS, textureFor } from '../../src/art/registry';
import { PALETTE } from '../../src/art/palette';
import { ROUND1 } from '../../src/art/sprites/round1';

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

describe('round 1 art', () => {
  const size = (sp: { rows: string[] }) => [sp.rows[0].length, sp.rows.length];

  it('every sprite is valid, overrides a known key and uses only palette colours', () => {
    const colours = new Set<string>(Object.values(PALETTE));
    for (const sp of ROUND1) {
      expect(validateSprite(sp), sp.key).toEqual([]);
      expect(TEXTURE_KEYS, sp.key).toContain(sp.key.split('@')[0]);
      for (const row of sp.rows) {
        for (const ch of row) if (ch !== '.') expect(colours.has(sp.palette[ch]), `${sp.key} '${ch}'`).toBe(true);
      }
    }
  });

  it('keeps the placeholder sizes (the tree may be taller, it is bottom-anchored)', () => {
    for (const sp of ROUND1) {
      const base = sp.key.split('@')[0];
      if (base === 'tree') continue;
      expect(size(sp), sp.key).toEqual(size(PLACEHOLDERS[base]));
    }
  });

  it('seasonal variants match their base size', () => {
    for (const sp of ROUND1.filter((s) => s.key.includes('@'))) {
      expect(size(sp), sp.key).toEqual(size(SPRITES[sp.key.split('@')[0]]));
    }
  });

  it('is what the registry serves, with winter variants', () => {
    for (const sp of ROUND1) expect(SPRITES[sp.key]).toBe(sp);
    for (const key of TEXTURE_KEYS) expect(SPRITES[key], key).toBeDefined();
    expect(textureFor('crop-wheat-3', 'winter')).toBe('crop-wheat-3@winter');
    expect(textureFor('horse-pony', 'winter')).toBe('horse-pony@winter');
    expect(textureFor('bld-coop', 'winter')).toBe('bld-coop@winter');
  });
});
