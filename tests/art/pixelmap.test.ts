import { describe, expect, it } from 'vitest';
import { validateSprite, type PixelSprite } from '../../src/art/pixelmap';
import { PLACEHOLDERS } from '../../src/art/sprites/placeholders';
import { TEXTURE_KEYS, textureFor } from '../../src/art/registry';

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
