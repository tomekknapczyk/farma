import type { Animal, BreedId, Rng } from './types';

/** Picks two distinct parents uniformly (rng draws: index A, index B, then a 50/50 breed pick) and returns
 * the chosen parent's breed. `parents` must hold >= 2 animals. */
export function inheritBreed(parents: Animal[], rng: Rng): BreedId {
  const i = Math.min(Math.floor(rng.next() * parents.length), parents.length - 1);
  let j = Math.min(Math.floor(rng.next() * (parents.length - 1)), parents.length - 2);
  if (j >= i) j += 1;
  const a = parents[i];
  const b = parents[j];
  const picked = rng.next() < 0.5 ? a : b;
  return picked.breed as BreedId;
}
