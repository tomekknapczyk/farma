import { capacity } from './animals';
import { BREEDS, XP } from './config';
import { addXp, isUnlocked, spend } from './economy';
import { newId } from './state';
import type { ActionResult, Animal, BreedId, Ctx, GameState, Rng } from './types';

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

export function buyHorse(s: GameState, ctx: Ctx, breed: BreedId, buildingId: string): ActionResult {
  void ctx;
  const def = BREEDS[breed];
  const b = s.buildings.find((v) => v.id === buildingId);
  if (!def || !b || b.kind !== 'stable') return { ok: false, reason: 'invalid' };
  if (!isUnlocked(s, { breed })) return { ok: false, reason: 'locked' };
  if (s.animals.filter((a) => a.buildingId === b.id).length >= capacity(b)) return { ok: false, reason: 'full' };
  if (!spend(s, def.cost)) return { ok: false, reason: 'no-money' };
  s.animals.push({
    id: newId(s, 'a'), species: 'horse', breed, buildingId: b.id, youngMsLeft: 0, sick: false, cycleMs: -1,
    productReady: false, treat: false, bornOnFarm: false,
  });
  if (!s.ownedBreeds.includes(breed)) s.ownedBreeds.push(breed);
  return { ok: true };
}

/** Selling is always allowed for adults (even the last horse of a breed); ownedBreeds remembers breeds forever. */
export function sellHorse(s: GameState, ctx: Ctx, animalId: string): ActionResult {
  const idx = s.animals.findIndex((a) => a.id === animalId);
  const a = idx >= 0 ? s.animals[idx] : undefined;
  if (!a || a.species !== 'horse' || a.breed === null) return { ok: false, reason: 'invalid' };
  if (a.youngMsLeft > 0) return { ok: false, reason: 'young' };
  const coins = BREEDS[a.breed].sale;
  const b = s.buildings.find((v) => v.id === a.buildingId);
  s.coins += coins;
  s.animals.splice(idx, 1);
  addXp(s, ctx, XP.sellHorse);
  ctx.events.push({ type: 'gain', x: b?.x ?? 0, y: b?.y ?? 0, coins, xp: XP.sellHorse, animalId: a.id });
  return { ok: true };
}
