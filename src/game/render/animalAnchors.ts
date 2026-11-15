/** Where each animal of a building stands (Phaser-free, pure: unit-tested). */
import { isoToScreen } from '../iso';

/**
 * Foot spots relative to the top corner of a building's 2x2 footprint (world px), all in the front
 * (lower) half of the footprint diamond, at least ~9 px apart. Listed in fill order: the first ones
 * are spread out, so a few animals do not bunch up. The first spot is just behind the trough
 * (sx - 16, foot y + 23), so that animal looks like it eats from it. 8 spots = the largest capacity.
 */
export const ANCHOR_SPOTS: readonly (readonly [number, number])[] = [
  [-16, 22], [16, 22.5], [8, 27.5], [0, 22.5], [-8, 17], [8, 17], [-24, 17], [24, 17],
];
const OVERFLOW_SHIFT = 3; // more animals than spots (not reachable in v1): shift each further round a little

export interface Anchor { x: number; y: number }

function idOrder(a: string, b: string): number {
  const na = Number(a.replace(/\D/g, ''));
  const nb = Number(b.replace(/\D/g, ''));
  return na !== nb && Number.isFinite(na) && Number.isFinite(nb) ? na - nb : a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Anchor (foot position, world px) for every animal of the building at tile (bx, by). The spot depends only
 * on the animal's rank by id among `animalIds` (ids grow, so a new animal never moves the older ones).
 */
export function animalAnchors(bx: number, by: number, animalIds: readonly string[]): Map<string, Anchor> {
  const { sx, sy } = isoToScreen(bx, by);
  const out = new Map<string, Anchor>();
  [...animalIds].sort(idOrder).forEach((id, rank) => {
    const [dx, dy] = ANCHOR_SPOTS[rank % ANCHOR_SPOTS.length];
    const shift = Math.floor(rank / ANCHOR_SPOTS.length) * OVERFLOW_SHIFT;
    out.set(id, { x: sx + dx + shift, y: sy + dy });
  });
  return out;
}
