import type Phaser from 'phaser';
import type { Season } from '../core/types';
import { drawSpriteToCanvas } from './pixelmap';
import type { PixelSprite } from './pixelmap';
import { PLACEHOLDERS } from './sprites/placeholders';
import { ROUND1 } from './sprites/round1';

const CROPS = ['wheat', 'carrot', 'corn', 'pumpkin'];
const BREEDS = ['pony', 'arabian', 'friesian'];

export const TEXTURE_KEYS: readonly string[] = [
  'tile-grass', 'tile-locked', 'field-dry', 'field-wet',
  ...CROPS.flatMap((c) => [0, 1, 2, 3].map((n) => `crop-${c}-${n}`)),
  'bld-coop', 'bld-barn', 'bld-stable',
  'trough-empty', 'trough-low', 'trough-full',
  'chicken', 'chicken-young', 'cow', 'cow-young',
  ...BREEDS.map((b) => `horse-${b}`),
  ...BREEDS.map((b) => `foal-${b}`),
  'tractor', 'tree',
  ...['water', 'sick', 'egg', 'milk', 'heart', 'hungry', 'lock'].map((i) => `icon-${i}`),
  // UI icons (DOM overlay)
  ...['coin', 'star', 'sun', 'rain', 'heat', 'snow', 'hand', 'seed', 'sickle', 'shop', 'parcel', 'upgrade']
    .map((i) => `icon-${i}`),
];

/** All pixel-map art: placeholders, overridden key by key by the real art rounds (registered later). */
export const SPRITES: Record<string, PixelSprite> = {
  ...PLACEHOLDERS,
  ...Object.fromEntries(ROUND1.map((sp) => [sp.key, sp])),
};

/** Every key that has art: all sprites (incl. seasonal `key@season` variants) plus manifest PNGs. */
const known = new Set<string>(Object.keys(SPRITES));

export function textureFor(base: string, season: Season): string {
  const seasonal = `${base}@${season}`;
  return known.has(seasonal) ? seasonal : base;
}

const MANIFEST_KEY = 'art-manifest';

/**
 * Plan B hook: `public/art/manifest.json` lists keys that have a PNG in `public/art/<key>.png`.
 * Call from `preload()`. Listed PNGs are queued and later win over the pixel-map placeholders.
 * A missing or broken manifest/PNG is ignored silently.
 */
export function preloadArt(scene: Phaser.Scene): void {
  scene.load.on('loaderror', () => { /* missing optional art: placeholders are used */ });
  scene.load.on(`filecomplete-json-${MANIFEST_KEY}`, (_key: string, _type: string, data: unknown) => {
    if (!Array.isArray(data)) return;
    for (const key of data) {
      if (typeof key !== 'string' || !/^[\w@-]+$/.test(key)) continue;
      known.add(key);
      scene.load.image(key, `art/${key}.png`);
    }
  });
  scene.load.json(MANIFEST_KEY, 'art/manifest.json');
}

/** Pixel-maps → canvas textures, except keys already loaded from PNG. Call from `create()`. */
export function registerAll(scene: Phaser.Scene): void {
  for (const sp of Object.values(SPRITES)) {
    if (scene.textures.exists(sp.key)) continue;
    const canvas = document.createElement('canvas');
    drawSpriteToCanvas(sp, canvas);
    scene.textures.addCanvas(sp.key, canvas);
  }
}
