import { CROPS, FIELD_COST, HEAT_GROWTH, LOW_YIELD_FACTOR, XP } from './config';
import { addXp, spend } from './economy';
import { canPlace, isTileUnlocked } from './map';
import { getSeasonInfo } from './seasons';
import { newId } from './state';
import type { ActionResult, CropId, Ctx, Field, GameState } from './types';

export function buildField(s: GameState, _ctx: Ctx, x: number, y: number): ActionResult {
  if (!isTileUnlocked(s, x, y)) return { ok: false, reason: 'locked' };
  if (!canPlace(s, x, y, 1, 1)) return { ok: false, reason: 'occupied' };
  if (!spend(s, FIELD_COST)) return { ok: false, reason: 'no-money' };
  s.fields.push({ id: newId(s, 'f'), x, y, crop: null, growthMs: 0, watered: false });
  return { ok: true };
}

export function canPlantNow(s: GameState, crop: CropId): ActionResult {
  const def = CROPS[crop];
  if (s.level < def.level) return { ok: false, reason: 'locked' };
  const { season } = getSeasonInfo(s.timeMs);
  if (!def.seasons.includes(season)) return { ok: false, reason: 'out-of-season' };
  return { ok: true };
}

export function plant(s: GameState, ctx: Ctx, fieldId: string, crop: CropId): ActionResult {
  const f = s.fields.find((x) => x.id === fieldId);
  if (!f) return { ok: false, reason: 'invalid' };
  if (f.crop !== null) return { ok: false, reason: 'occupied' };
  const can = canPlantNow(s, crop);
  if (!can.ok) return can;
  const useFree = s.freeSeeds[crop] > 0;
  if (!useFree && s.coins < CROPS[crop].seed) return { ok: false, reason: 'no-money' };
  if (useFree) s.freeSeeds[crop] -= 1;
  else spend(s, CROPS[crop].seed);
  f.crop = crop;
  f.growthMs = 0;
  f.watered = s.weather.kind === 'rain';
  addXp(s, ctx, XP.plant);
  return { ok: true };
}

export function isReady(f: Field): boolean {
  return f.crop !== null && f.growthMs >= CROPS[f.crop].growMs;
}

export function cropStage(f: Field): 0 | 1 | 2 | 3 {
  if (f.crop === null) return 0;
  const p = f.growthMs / CROPS[f.crop].growMs;
  if (p >= 1) return 3;
  if (p >= 2 / 3) return 2;
  if (p >= 1 / 3) return 1;
  return 0;
}

export function water(s: GameState, _ctx: Ctx, fieldId: string): ActionResult {
  const f = s.fields.find((x) => x.id === fieldId);
  if (!f || f.crop === null || isReady(f) || f.watered) return { ok: false, reason: 'invalid' };
  f.watered = true;
  return { ok: true };
}

export function harvest(s: GameState, ctx: Ctx, fieldId: string): ActionResult {
  const f = s.fields.find((x) => x.id === fieldId);
  if (!f || f.crop === null) return { ok: false, reason: 'invalid' };
  if (!isReady(f)) return { ok: false, reason: 'not-ready' };
  const def = CROPS[f.crop];
  const qty = f.watered ? def.yield : Math.max(1, Math.round(def.yield * LOW_YIELD_FACTOR));
  s.storage[f.crop] += qty;
  addXp(s, ctx, def.xp);
  ctx.events.push({ type: 'gain', x: f.x, y: f.y, item: f.crop, qty, xp: def.xp });
  f.crop = null;
  f.growthMs = 0;
  f.watered = false;
  return { ok: true, n: qty };
}

export function updateCrops(s: GameState, _ctx: Ctx, dt: number): void {
  const rain = s.weather.kind === 'rain';
  const factor = s.weather.kind === 'heat' ? HEAT_GROWTH : 1;
  for (const f of s.fields) {
    if (f.crop === null) continue;
    if (rain) f.watered = true;
    if (!isReady(f)) f.growthMs = Math.min(CROPS[f.crop].growMs, f.growthMs + dt * factor);
  }
}
