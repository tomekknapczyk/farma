import {
  BREEDS, BUILDINGS, CROPS, MAX_LEVEL, PARCEL_LEVEL, PRODUCTS, SAFETY_NET, SPECIES, TRACTOR, UPGRADE, xpToNext,
} from './config';
import { canPlantNow } from './crops';
import type { ActionResult, BreedId, BuildingKind, CropId, Ctx, GameState, ItemId, SpeciesId } from './types';

/** Atomic: returns false and changes nothing if unaffordable. */
export function spend(s: GameState, amount: number): boolean {
  if (s.coins < amount) return false;
  s.coins -= amount;
  return true;
}

/** Cumulative xp needed to reach `level` (level 1 = 0). */
export function levelThreshold(level: number): number {
  let t = 0;
  for (let l = 1; l < level; l++) t += xpToNext(l);
  return t;
}

/**
 * A save made under an older xp curve can hold xp below the current level's threshold (level never drops, so
 * unlocks are kept). Raise xp to that threshold so the level bar starts at 0 and moves again. Never lowers level.
 */
export function normalizeProgress(s: GameState): void {
  const min = levelThreshold(s.level);
  if (s.xp < min) s.xp = min;
}

/** s.xp is cumulative. Levels up in a loop (one levelUp event each) until MAX_LEVEL; xp keeps growing there. */
export function addXp(s: GameState, ctx: Ctx, n: number): void {
  s.xp += n;
  while (s.level < MAX_LEVEL && s.xp >= levelThreshold(s.level + 1)) {
    s.level += 1;
    ctx.events.push({ type: 'levelUp', level: s.level });
  }
}

/** At MAX_LEVEL: needed = xpToNext(MAX_LEVEL) and current is capped at needed (bar stays full). */
export function xpProgress(s: GameState): { level: number; current: number; needed: number } {
  const needed = xpToNext(s.level);
  const current = Math.min(Math.max(s.xp - levelThreshold(s.level), 0), needed);
  return { level: s.level, current, needed };
}

export function sell(s: GameState, ctx: Ctx, item: ItemId, qty: number): ActionResult {
  if (!Number.isInteger(qty) || qty <= 0) return { ok: false, reason: 'invalid' };
  if (s.storage[item] < qty) return { ok: false, reason: 'no-item' };
  const price = item in CROPS ? CROPS[item as CropId].price : PRODUCTS[item as keyof typeof PRODUCTS].price;
  const earned = price * qty;
  s.storage[item] -= qty;
  s.coins += earned;
  void ctx;
  return { ok: true, n: earned };
}

export type Unlockable =
  | { crop: CropId } | { species: SpeciesId } | { breed: BreedId } | { building: BuildingKind }
  | 'parcels' | 'tractor' | 'upgrade';

function levelFor(what: Unlockable): number {
  if (what === 'parcels') return PARCEL_LEVEL;
  if (what === 'tractor') return TRACTOR.level;
  if (what === 'upgrade') return UPGRADE.level;
  if ('crop' in what) return CROPS[what.crop].level;
  if ('species' in what) return SPECIES[what.species].level;
  if ('breed' in what) return BREEDS[what.breed].level;
  return BUILDINGS[what.building].level;
}

export function isUnlocked(s: GameState, what: Unlockable): boolean {
  return s.level >= levelFor(what);
}

/** Unlock keys gained exactly at `level` (for the level-up screen). Horse species is not purchasable, so omitted. */
export function unlocksAt(level: number): string[] {
  const out: string[] = [];
  for (const [k, d] of Object.entries(CROPS)) if (d.level === level) out.push(`crop:${k}`);
  if (PARCEL_LEVEL === level) out.push('parcels');
  for (const [k, d] of Object.entries(BUILDINGS)) if (d.level === level) out.push(`building:${k}`);
  for (const [k, d] of Object.entries(SPECIES)) if (d.level === level && d.cost !== null) out.push(`species:${k}`);
  for (const [k, d] of Object.entries(BREEDS)) if (d.level === level) out.push(`breed:${k}`);
  if (TRACTOR.level === level) out.push('tractor');
  if (UPGRADE.level === level) out.push('upgrade');
  return out;
}

export function updateSafetyNet(s: GameState, ctx: Ctx): void {
  if (s.timeMs < s.safetyNetAtMs) return;
  s.safetyNetAtMs = s.timeMs + SAFETY_NET.checkMs;

  const plantable = (Object.keys(CROPS) as CropId[]).filter((c) => canPlantNow(s, c).ok);
  const threshold = plantable.length > 0 ? Math.min(...plantable.map((c) => CROPS[c].seed)) : 5;
  if (s.coins >= threshold) return;
  if (s.fields.some((f) => f.crop !== null)) return;
  const stored = Object.values(s.storage).reduce((a, b) => a + b, 0);
  if (stored > 0) return;
  if (s.animals.some((a) => a.productReady)) return;

  if (canPlantNow(s, 'wheat').ok) {
    s.freeSeeds.wheat += SAFETY_NET.seeds;
  } else {
    s.storage.wheat += SAFETY_NET.winterWheat;
    s.coins += SAFETY_NET.winterCoins;
  }
  ctx.events.push({ type: 'safetyNet' });
}
