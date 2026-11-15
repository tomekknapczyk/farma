// Headless balance bot: plays the real core logic. Usage: npm run sim -- --hours 14 --seed 1
import { BUILDINGS, CROPS, FIELD_COST, MAP_SIZE, MAX_LEVEL, PARCEL_SIZE, SPECIES, TRACTOR, parcelCost } from '../src/core/config';
import { buildBuilding, buyAnimal, callVet, capacity, collectProduct, fillTrough, upgradeBuilding } from '../src/core/animals';
import { buildField, canPlantNow, harvest, isReady, plant, water } from '../src/core/crops';
import { isUnlocked, sell } from '../src/core/economy';
import { buyHorse, sellHorse } from '../src/core/horses';
import { buyParcel, canPlace } from '../src/core/map';
import { createRng } from '../src/core/rng';
import { createInitialState } from '../src/core/state';
import { tick } from '../src/core/tick';
import { buyTractor } from '../src/core/tractor';
import type { BuildingKind, CropId, Ctx, GameState } from '../src/core/types';

function arg(name: string, def: number): number {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? Number(process.argv[i + 1]) : def;
  return Number.isFinite(v) ? v : def;
}

const FEED_STOCK = 10;
const CROP_IDS = Object.keys(CROPS) as CropId[];

function findSpot(s: GameState, w: number, h: number, fromEnd: boolean): [number, number] | null {
  const range = [...Array(MAP_SIZE).keys()];
  const ys = fromEnd ? range.slice().reverse() : range;
  const xs = fromEnd ? range.slice().reverse() : range;
  for (const y of ys) for (const x of xs) {
    // for a 2x2 anchored at top-left, iterate anchors; fromEnd just changes preference order
    if (canPlace(s, x, y, w, h)) return [x, y];
  }
  return null;
}

function cheapScan(s: GameState, ctx: Ctx): void {
  const animalsExist = s.animals.length > 0;
  for (const f of s.fields) if (isReady(f)) harvest(s, ctx, f.id);
  for (const f of s.fields) if (f.crop !== null && !f.watered) water(s, ctx, f.id);
  for (const a of s.animals) {
    if (a.productReady) collectProduct(s, ctx, a.id);
    if (a.sick) callVet(s, ctx, a.id);
  }
  // plant: most expensive plantable crop; wheat first if feed stock is low
  const empty = s.fields.filter((f) => f.crop === null);
  if (empty.length > 0) {
    const options = CROP_IDS.filter((c) => canPlantNow(s, c).ok && (s.freeSeeds[c] > 0 || s.coins >= CROPS[c].seed));
    const byPrice = options.slice().sort((a, b) => CROPS[b].price * CROPS[b].yield / CROPS[b].growMs - CROPS[a].price * CROPS[a].yield / CROPS[a].growMs);
    for (const f of empty) {
      let pick = byPrice[0];
      if (animalsExist && s.storage.wheat < FEED_STOCK && options.includes('wheat')) pick = 'wheat';
      else if (animalsExist && s.animals.some((a) => a.species === 'horse') && s.storage.carrot < FEED_STOCK && options.includes('carrot')) pick = 'carrot';
      if (!pick) break;
      if (!plant(s, ctx, f.id, pick).ok) break;
    }
  }
  // troughs
  for (const b of s.buildings) {
    if (!s.animals.some((a) => a.buildingId === b.id)) continue;
    for (const item of BUILDINGS[b.kind].feeds) {
      if (b.trough < 5 && s.storage[item] > 0) fillTrough(s, ctx, b.id, item, 10);
    }
  }
  // sell surplus
  const keep = animalsExist ? FEED_STOCK : 0;
  for (const c of CROP_IDS) {
    const extra = c === 'pumpkin' ? s.storage[c] : s.storage[c] - keep;
    if (extra > 0) sell(s, ctx, c, extra);
  }
  if (s.storage.egg > 0) sell(s, ctx, 'egg', s.storage.egg);
  if (s.storage.milk > 0) sell(s, ctx, 'milk', s.storage.milk);
}

function buyStep(s: GameState, ctx: Ctx): void {
  // sell adult farm-born horses when stable full
  for (const b of s.buildings.filter((v) => v.kind === 'stable')) {
    const inside = s.animals.filter((a) => a.buildingId === b.id);
    if (inside.length >= capacity(b)) {
      const h = inside.find((a) => a.species === 'horse' && a.bornOnFarm && a.youngMsLeft <= 0 && !a.sick);
      if (h) sellHorse(s, ctx, h.id);
    }
  }
  // buildings (one per kind first)
  for (const kind of Object.keys(BUILDINGS) as BuildingKind[]) {
    const d = BUILDINGS[kind];
    if (!isUnlocked(s, { building: kind }) || s.buildings.some((b) => b.kind === kind)) continue;
    if (s.coins >= 2 * d.cost) {
      const spot = findSpot(s, 2, 2, true);
      if (spot) { buildBuilding(s, ctx, kind, spot[0], spot[1]); return; }
    }
    // saving for a building: do not spend elsewhere on low-priority stuff
  }
  // animals
  for (const b of s.buildings) {
    const inside = s.animals.filter((a) => a.buildingId === b.id).length;
    if (inside >= capacity(b)) continue;
    if (b.kind === 'stable') {
      const pony = s.coins >= 2 * 300;
      if (pony && buyHorse(s, ctx, 'pony', b.id).ok) return;
      continue;
    }
    const sp = b.kind === 'coop' ? 'chicken' : 'cow';
    if (s.coins >= 2 * (SPECIES[sp].cost ?? 0) && buyAnimal(s, ctx, sp, b.id).ok) return;
  }
  // fields (keep a free 2x2 reserve implicitly by capping fields to 60% of unlocked tiles)
  const unlockedTiles = s.parcels.filter(Boolean).length * PARCEL_SIZE * PARCEL_SIZE;
  if (s.coins >= 2 * FIELD_COST && s.fields.length < Math.floor(unlockedTiles * 0.6)) {
    const spot = findSpot(s, 1, 1, false);
    if (spot && buildField(s, ctx, spot[0], spot[1]).ok) return;
  }
  // parcels
  if (isUnlocked(s, 'parcels')) {
    const bought = s.parcels.filter(Boolean).length - 1;
    if (s.coins >= 2 * parcelCost(bought)) {
      for (let i = 0; i < s.parcels.length; i++) if (!s.parcels[i] && buyParcel(s, ctx, i).ok) return;
    }
  }
  if (!s.hasTractor && isUnlocked(s, 'tractor') && s.coins >= 2 * TRACTOR.cost) { buyTractor(s, ctx); return; }
  if (isUnlocked(s, 'upgrade')) {
    for (const b of s.buildings) {
      if (!b.upgraded && s.coins >= 2 * 500 && upgradeBuilding(s, ctx, b.id).ok) return;
    }
  }
}

function main(): void {
  const hours = arg('hours', 14);
  const seed = arg('seed', 1);
  const s = createInitialState(seed);
  const ctx: Ctx = { rng: createRng(seed), events: [] };
  const reached: number[] = [0];
  const steps = Math.round(hours * 3600);
  for (let i = 0; i < steps; i++) {
    cheapScan(s, ctx);
    if (i % 10 === 0) buyStep(s, ctx);
    tick(s, ctx, 1000);
    ctx.events.length = 0;
    while (reached.length < s.level) reached.push(Math.round((s.timeMs / 60000) * 10) / 10);
  }
  console.log(`seed ${seed}, ${hours} h`);
  console.log('level | game minute');
  for (let l = 2; l <= MAX_LEVEL; l++) console.log(`${String(l).padStart(5)} | ${reached[l - 1] ?? 'not reached'}`);
  console.log(`coins ${s.coins}, level ${s.level}, fields ${s.fields.length}, animals ${s.animals.length}, parcels ${s.parcels.filter(Boolean).length}, tractor ${s.hasTractor}`);
}
main();
