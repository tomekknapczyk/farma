import {
  BIRTH_CHANCE, BIRTH_CHANCE_TREAT, BUILDINGS, CROPS, SICK_CHANCE, SPECIES, TREAT_SPEED, TROUGH_CAP, TROUGH_CAP_UP,
  UPGRADE, XP,
} from './config';
import { addXp, isUnlocked, spend } from './economy';
import { inheritBreed } from './horses';
import { canPlace } from './map';
import { newId } from './state';
import type { ActionResult, Animal, Building, BuildingKind, Ctx, GameState, ItemId } from './types';

export function capacity(b: Building): number {
  const d = BUILDINGS[b.kind];
  return b.upgraded ? d.capUp : d.cap;
}

export function troughCap(b: Building): number {
  return b.upgraded ? TROUGH_CAP_UP : TROUGH_CAP;
}

export function buildBuilding(s: GameState, ctx: Ctx, kind: BuildingKind, x: number, y: number): ActionResult {
  const d = BUILDINGS[kind];
  if (!d) return { ok: false, reason: 'invalid' };
  if (!isUnlocked(s, { building: kind })) return { ok: false, reason: 'locked' };
  if (!canPlace(s, x, y, 2, 2)) return { ok: false, reason: 'occupied' };
  if (!spend(s, d.cost)) return { ok: false, reason: 'no-money' };
  s.buildings.push({ id: newId(s, 'b'), kind, x, y, upgraded: false, trough: 0 });
  addXp(s, ctx, XP.buy);
  return { ok: true };
}

export function upgradeBuilding(s: GameState, ctx: Ctx, buildingId: string): ActionResult {
  const b = s.buildings.find((v) => v.id === buildingId);
  if (!b || b.upgraded) return { ok: false, reason: 'invalid' };
  if (!isUnlocked(s, 'upgrade')) return { ok: false, reason: 'locked' };
  if (!spend(s, UPGRADE.cost[b.kind])) return { ok: false, reason: 'no-money' };
  b.upgraded = true;
  addXp(s, ctx, XP.buy);
  return { ok: true };
}

export function buyAnimal(s: GameState, ctx: Ctx, species: 'chicken' | 'cow', buildingId: string): ActionResult {
  const def = SPECIES[species];
  const b = s.buildings.find((v) => v.id === buildingId);
  if (!def || def.cost === null || !b || b.kind !== def.building) return { ok: false, reason: 'invalid' };
  if (!isUnlocked(s, { species })) return { ok: false, reason: 'locked' };
  if (s.animals.filter((a) => a.buildingId === b.id).length >= capacity(b)) return { ok: false, reason: 'full' };
  if (!spend(s, def.cost)) return { ok: false, reason: 'no-money' };
  s.animals.push({
    id: newId(s, 'a'), species, breed: null, buildingId: b.id, youngMsLeft: 0, sick: false, cycleMs: -1,
    productReady: false, treat: false, bornOnFarm: false,
  });
  addXp(s, ctx, XP.buy);
  return { ok: true };
}

export function fillTrough(s: GameState, ctx: Ctx, buildingId: string, item: ItemId, qty: number): ActionResult {
  const b = s.buildings.find((v) => v.id === buildingId);
  if (!b || !Number.isInteger(qty) || qty <= 0) return { ok: false, reason: 'invalid' };
  if (!(BUILDINGS[b.kind].feeds as ItemId[]).includes(item)) return { ok: false, reason: 'invalid' };
  if (s.storage[item] <= 0) return { ok: false, reason: 'no-item' };
  const feed = CROPS[item as keyof typeof CROPS].feed;
  const k = Math.min(qty, s.storage[item], Math.floor((troughCap(b) - b.trough) / feed));
  if (k <= 0) return { ok: false, reason: 'full' };
  b.trough += k * feed;
  s.storage[item] -= k;
  addXp(s, ctx, XP.feed);
  return { ok: true, n: k };
}

/** Treats on young animals are allowed (they keep the treat until their first cycle ends). */
export function giveTreat(s: GameState, ctx: Ctx, animalId: string): ActionResult {
  const a = s.animals.find((v) => v.id === animalId);
  if (!a) return { ok: false, reason: 'invalid' };
  if (a.sick) return { ok: false, reason: 'sick' };
  if (a.treat) return { ok: false, reason: 'invalid' };
  if (s.storage.carrot < 1) return { ok: false, reason: 'no-item' };
  s.storage.carrot -= 1;
  a.treat = true;
  addXp(s, ctx, XP.treat);
  return { ok: true };
}

export function callVet(s: GameState, ctx: Ctx, animalId: string): ActionResult {
  void ctx;
  const a = s.animals.find((v) => v.id === animalId);
  if (!a || !a.sick) return { ok: false, reason: 'invalid' };
  if (!spend(s, SPECIES[a.species].vet)) return { ok: false, reason: 'no-money' };
  a.sick = false;
  return { ok: true };
}

export function collectProduct(s: GameState, ctx: Ctx, animalId: string): ActionResult {
  const a = s.animals.find((v) => v.id === animalId);
  if (!a) return { ok: false, reason: 'invalid' };
  const product = SPECIES[a.species].product;
  if (!a.productReady || product === null) return { ok: false, reason: 'not-ready' };
  const b = s.buildings.find((v) => v.id === a.buildingId);
  a.productReady = false;
  s.storage[product] += 1;
  ctx.events.push({ type: 'gain', x: b?.x ?? 0, y: b?.y ?? 0, item: product, qty: 1, xp: XP.collect });
  addXp(s, ctx, XP.collect);
  return { ok: true };
}

export function animalStatus(a: Animal): 'young' | 'sick' | 'ready' | 'hungry' | 'working' {
  if (a.youngMsLeft > 0) return 'young';
  if (a.sick) return 'sick';
  if (a.productReady) return 'ready';
  if (a.cycleMs === -1) return 'hungry';
  return 'working';
}

/**
 * rng draw order at cycle end: (1) sickness roll, always; (2) birth roll, only if eligible
 * (>= 2 healthy adults of the species in the building at that moment, and building not full);
 * horse foals then draw inheritBreed's rng values after the birth roll.
 */
export function updateAnimals(s: GameState, ctx: Ctx, dt: number): void {
  const existing = s.animals.slice(); // newborns do not act in the tick they are born
  for (const a of existing) {
    if (a.youngMsLeft > 0) {
      a.youngMsLeft = Math.max(0, a.youngMsLeft - dt);
      continue;
    }
    if (a.sick || a.productReady) continue;
    const b = s.buildings.find((v) => v.id === a.buildingId);
    if (!b) continue;
    const def = SPECIES[a.species];
    if (a.cycleMs === -1) {
      if (b.trough < def.needFeed) continue;
      b.trough -= def.needFeed;
      a.cycleMs = 0;
    }
    a.cycleMs += dt * (a.treat ? TREAT_SPEED : 1);
    if (a.cycleMs < def.cycleMs) continue;

    a.cycleMs = -1;
    if (def.product !== null) a.productReady = true;
    if (ctx.rng.next() < SICK_CHANCE) {
      a.sick = true;
      ctx.events.push({ type: 'sick', animalId: a.id });
    }
    const mates = s.animals.filter(
      (o) => o.buildingId === b.id && o.species === a.species && !o.sick && o.youngMsLeft <= 0,
    );
    const inBuilding = s.animals.filter((o) => o.buildingId === b.id).length;
    if (mates.length >= 2 && inBuilding < capacity(b)) {
      const chance = a.treat && a.species === 'horse' ? BIRTH_CHANCE_TREAT : BIRTH_CHANCE;
      if (ctx.rng.next() < chance) {
        let breed = null;
        if (a.species === 'horse') {
          breed = inheritBreed(mates, ctx.rng);
          if (!s.ownedBreeds.includes(breed)) s.ownedBreeds.push(breed);
        }
        const young: Animal = {
          id: newId(s, 'a'), species: a.species, breed, buildingId: b.id, youngMsLeft: def.youngMs, sick: false,
          cycleMs: -1, productReady: false, treat: false, bornOnFarm: true,
        };
        s.animals.push(young);
        ctx.events.push({ type: 'born', animalId: young.id });
      }
    }
    a.treat = false;
  }
}
