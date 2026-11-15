// Headless balance bot: plays the real core logic. Usage: npm run sim -- --hours 14 --seed 1 [--taps 40]
//
// Tap budget (--taps, default 40): max XP-generating actions per game minute (plant, water, harvest,
// collectProduct, giveTreat = 1 each; one useTractor call = 1). Models a child's tapping speed. Sell, fill
// trough, buy and vet are free. The tractor is preferred once owned.
//
// Bot heuristics. Crops: plant the plantable, affordable crop with the best price*yield/growMs; wheat (or carrot
// when horses exist) when feed stock < 10 and animals exist. Surplus sold above 10 of each crop (all if no animals).
// Purchase order (every 10 s, when coins >= 2x price): sell farm-born adult horses if stable full, one building per
// kind, animals (pony for stable), field (first free tile, at most 60% of unlocked tiles), parcel (index order,
// adjacent), tractor, building upgrades.
// Note: seeds barely differ, only weather and sickness are random.
import { BUILDINGS, CROPS, FIELD_COST, MAP_SIZE, MAX_LEVEL, PARCEL_SIZE, SPECIES, TRACTOR, parcelCost } from '../src/core/config';
import { buildBuilding, buyAnimal, callVet, capacity, collectProduct, fillTrough, upgradeBuilding } from '../src/core/animals';
import { buildField, canPlantNow, harvest, isReady, plant, water } from '../src/core/crops';
import { isUnlocked, sell } from '../src/core/economy';
import { buyHorse, sellHorse } from '../src/core/horses';
import { buyParcel, canPlace } from '../src/core/map';
import { createRng } from '../src/core/rng';
import { createInitialState } from '../src/core/state';
import { tick } from '../src/core/tick';
import { buyTractor, useTractor } from '../src/core/tractor';
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
  // fromEnd: scan anchors from the bottom-right so buildings stay away from the field area (top-left first)
  const ys = fromEnd ? range.slice().reverse() : range;
  const xs = fromEnd ? range.slice().reverse() : range;
  for (const y of ys) for (const x of xs) {
    if (canPlace(s, x, y, w, h)) return [x, y];
  }
  return null;
}

function cheapScan(s: GameState, ctx: Ctx, bud: { taps: number }): void {
  const animalsExist = s.animals.length > 0;
  const tap = (): boolean => { if (bud.taps < 1) return false; bud.taps -= 1; return true; };
  const hasField = (x: number, y: number) => s.fields.some((f) => f.x === x && f.y === y);
  if (s.hasTractor) {
    const covered = new Set<string>();
    for (const f of s.fields.slice().sort((a, b) => a.y - b.y || a.x - b.x)) {
      if (covered.has(`${f.x},${f.y}`)) continue;
      const seg: typeof s.fields = [];
      for (let i = 0; i < TRACTOR.rowLength && hasField(f.x + i, f.y); i++) {
        covered.add(`${f.x + i},${f.y}`);
        seg.push(s.fields.find((g) => g.x === f.x + i && g.y === f.y)!);
      }
      if (seg.some((g) => isReady(g) || (g.crop !== null && !g.watered)) && tap()) useTractor(s, ctx, f.x, f.y);
    }
  } else {
    for (const f of s.fields) if (isReady(f) && tap()) harvest(s, ctx, f.id);
  }
  for (const a of s.animals) {
    if (a.productReady && tap()) collectProduct(s, ctx, a.id);
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
      if (!pick || !tap()) break;
      if (!plant(s, ctx, f.id, pick).ok) { bud.taps += 1; break; }
    }
  }
  if (!s.hasTractor) for (const f of s.fields) if (f.crop !== null && !f.watered && tap()) water(s, ctx, f.id);
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
  const taps = arg('taps', 40);
  const bud = { taps };
  let fifthField = -1, firstCoop = -1;
  const reached: number[] = [0];
  const steps = Math.round(hours * 3600);
  for (let i = 0; i < steps; i++) {
    bud.taps = Math.min(taps, bud.taps + taps / 60);
    cheapScan(s, ctx, bud);
    if (i % 10 === 0) buyStep(s, ctx);
    tick(s, ctx, 1000);
    ctx.events.length = 0;
    const min = Math.round((s.timeMs / 60000) * 10) / 10;
    if (fifthField < 0 && s.fields.length >= 5) fifthField = min;
    if (firstCoop < 0 && s.buildings.some((b) => b.kind === 'coop')) firstCoop = min;
    while (reached.length < s.level) reached.push(Math.round((s.timeMs / 60000) * 10) / 10);
  }
  console.log(`seed ${seed}, ${hours} h`);
  console.log('level | game minute');
  for (let l = 2; l <= MAX_LEVEL; l++) console.log(`${String(l).padStart(5)} | ${reached[l - 1] ?? 'not reached'}`);
  console.log(`5th field at min ${fifthField}, first coop at min ${firstCoop}`);
  console.log(`coins ${s.coins}, level ${s.level}, fields ${s.fields.length}, animals ${s.animals.length}, parcels ${s.parcels.filter(Boolean).length}, tractor ${s.hasTractor}`);
}
main();
