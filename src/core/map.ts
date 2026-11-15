import { MAP_SIZE, PARCEL_LEVEL, PARCEL_SIZE, XP, parcelCost } from './config';
import { addXp, spend } from './economy';
import type { ActionResult, Building, Ctx, Field, GameState } from './types';

const PARCELS_PER_ROW = MAP_SIZE / PARCEL_SIZE;

export function parcelOf(x: number, y: number): number {
  return Math.floor(y / PARCEL_SIZE) * PARCELS_PER_ROW + Math.floor(x / PARCEL_SIZE);
}

function inMap(x: number, y: number): boolean {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < MAP_SIZE && y < MAP_SIZE;
}

export function isTileUnlocked(s: GameState, x: number, y: number): boolean {
  return inMap(x, y) && s.parcels[parcelOf(x, y)] === true;
}

export function tileOccupant(
  s: GameState, x: number, y: number,
): { kind: 'field'; field: Field } | { kind: 'building'; building: Building } | null {
  const field = s.fields.find((f) => f.x === x && f.y === y);
  if (field) return { kind: 'field', field };
  const building = s.buildings.find((b) => x >= b.x && x < b.x + 2 && y >= b.y && y < b.y + 2);
  if (building) return { kind: 'building', building };
  return null;
}

export function canPlace(s: GameState, x: number, y: number, w: number, h: number): boolean {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      if (!isTileUnlocked(s, x + dx, y + dy) || tileOccupant(s, x + dx, y + dy)) return false;
    }
  }
  return true;
}

export function buyParcel(s: GameState, ctx: Ctx, index: number): ActionResult {
  if (!Number.isInteger(index) || index < 0 || index >= s.parcels.length || s.parcels[index]) {
    return { ok: false, reason: 'invalid' };
  }
  if (s.level < PARCEL_LEVEL) return { ok: false, reason: 'locked' };
  const px = index % PARCELS_PER_ROW;
  const py = Math.floor(index / PARCELS_PER_ROW);
  const adjacent =
    (px > 0 && s.parcels[index - 1]) ||
    (px < PARCELS_PER_ROW - 1 && s.parcels[index + 1]) ||
    (py > 0 && s.parcels[index - PARCELS_PER_ROW]) ||
    (py < PARCELS_PER_ROW - 1 && s.parcels[index + PARCELS_PER_ROW]);
  if (!adjacent) return { ok: false, reason: 'invalid' };
  const bought = s.parcels.filter(Boolean).length - 1;
  if (!spend(s, parcelCost(bought))) return { ok: false, reason: 'no-money' };
  s.parcels[index] = true;
  addXp(s, ctx, XP.buy);
  return { ok: true };
}
