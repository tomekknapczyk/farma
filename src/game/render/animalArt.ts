/** Texture keys for animals and their status icons (Phaser-free: shared by the scene and the DOM UI). */
import { animalStatus } from '../../core/animals';
import type { Animal } from '../../core/types';

export function animalTexture(a: Animal): string {
  const young = a.youngMsLeft > 0;
  if (a.species === 'horse') return `${young ? 'foal' : 'horse'}-${a.breed ?? 'pony'}`;
  return young ? `${a.species}-young` : a.species;
}

export function statusIcon(a: Animal): string | null {
  switch (animalStatus(a)) {
    case 'sick': return 'icon-sick';
    case 'ready': return a.species === 'cow' ? 'icon-milk' : 'icon-egg';
    case 'hungry': return 'icon-hungry';
    default: return null;
  }
}
