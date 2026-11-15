/** Pixel sprites as DOM images (scaled with nearest-neighbour, cached per key+scale). */
import { drawSpriteToCanvas } from '../art/pixelmap';
import { PLACEHOLDERS } from '../art/sprites/placeholders';
import type { ItemId } from '../core/types';

const cache = new Map<string, string>();

export function iconUrl(key: string, scale = 3): string {
  const id = `${key}@${scale}`;
  const hit = cache.get(id);
  if (hit !== undefined) return hit;
  const sp = PLACEHOLDERS[key] ?? PLACEHOLDERS['icon-lock'];
  const src = document.createElement('canvas');
  drawSpriteToCanvas(sp, src);
  const out = document.createElement('canvas');
  out.width = src.width * scale;
  out.height = src.height * scale;
  const g = out.getContext('2d');
  let url = '';
  if (g) {
    g.imageSmoothingEnabled = false;
    g.drawImage(src, 0, 0, out.width, out.height);
    url = out.toDataURL();
  }
  cache.set(id, url);
  return url;
}

/** <img> of a sprite; `cls` adds CSS classes (size is set by CSS, pixelated). */
export function icon(key: string, cls = '', scale = 3): HTMLImageElement {
  const img = document.createElement('img');
  img.src = iconUrl(key, scale);
  img.alt = '';
  img.draggable = false;
  img.className = `px ${cls}`.trim();
  return img;
}

export function itemIcon(item: ItemId): string {
  return item === 'egg' || item === 'milk' ? `icon-${item}` : `crop-${item}-3`;
}

export { animalTexture as animalIcon } from '../game/render/farmView';

/** Icon for an unlocksAt() key such as 'crop:carrot', 'building:coop', 'parcels'. */
export function unlockIcon(key: string): string {
  const [kind, id] = key.split(':');
  switch (kind) {
    case 'crop': return `crop-${id}-3`;
    case 'building': return `bld-${id}`;
    case 'species': return id;
    case 'breed': return `horse-${id}`;
    case 'parcels': return 'icon-parcel';
    case 'tractor': return 'tractor';
    case 'upgrade': return 'icon-upgrade';
    default: return 'icon-star';
  }
}
