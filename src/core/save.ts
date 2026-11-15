import { BREEDS, BUILDINGS, CROPS, MAX_LEVEL, SPECIES, WEATHER_TABLE } from './config';
import { createInitialState } from './state';
import type { GameState } from './types';

export const SAVE_KEY = 'farma.save.v1';
export const CORRUPT_KEY = 'farma.save.corrupt';

type Store = Pick<Storage, 'getItem' | 'setItem'>;

const ITEM_IDS = ['wheat', 'carrot', 'corn', 'pumpkin', 'egg', 'milk'];
const CROP_IDS = Object.keys(CROPS);
const BUILDING_KINDS = Object.keys(BUILDINGS);
const SPECIES_IDS = Object.keys(SPECIES);
const BREED_IDS = Object.keys(BREEDS);
const SEASONS = Object.keys(WEATHER_TABLE);
const WEATHER_KINDS = [...new Set(Object.values(WEATHER_TABLE).flatMap((t) => Object.keys(t)))];

export function serialize(s: GameState): string {
  return JSON.stringify(s);
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const numRecord = (v: unknown, keys: string[]): boolean => isObj(v) && keys.every((k) => isNum(v[k]));
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
const isStr = (v: unknown): v is string => typeof v === 'string';
const oneOf = (v: unknown, list: readonly string[]): boolean => isStr(v) && list.includes(v);

function validField(f: unknown): boolean {
  return isObj(f) && isStr(f.id) && isNum(f.x) && isNum(f.y) && (f.crop === null || oneOf(f.crop, CROP_IDS))
    && isNum(f.growthMs) && isBool(f.watered);
}

function validBuilding(b: unknown): boolean {
  return isObj(b) && isStr(b.id) && oneOf(b.kind, BUILDING_KINDS) && isNum(b.x) && isNum(b.y) && isBool(b.upgraded)
    && isNum(b.trough);
}

function validAnimal(a: unknown, buildingIds: Set<string>): boolean {
  if (!isObj(a) || !isStr(a.id) || !oneOf(a.species, SPECIES_IDS)) return false;
  // horses always have a breed; chickens and cows never need one
  if (a.species === 'horse' ? !oneOf(a.breed, BREED_IDS) : !(a.breed === null || oneOf(a.breed, BREED_IDS))) return false;
  return isStr(a.buildingId) && buildingIds.has(a.buildingId) && isNum(a.youngMsLeft) && isNum(a.cycleMs)
    && isBool(a.sick) && isBool(a.productReady) && isBool(a.treat) && isBool(a.bornOnFarm);
}

export function deserialize(json: string): GameState | null {
  let o: unknown;
  try { o = JSON.parse(json); } catch { return null; }
  if (!isObj(o) || o.version !== 1) return null;
  if (!isNum(o.timeMs) || !isNum(o.coins) || o.coins < 0 || !isNum(o.xp) || !isNum(o.level)
    || !Number.isInteger(o.level) || o.level < 1 || o.level > MAX_LEVEL
    || !isNum(o.nextId) || !isNum(o.safetyNetAtMs)) return null;
  if (!numRecord(o.storage, ITEM_IDS) || !numRecord(o.freeSeeds, CROP_IDS)) return null;
  if (!Array.isArray(o.parcels) || o.parcels.length !== 16 || !o.parcels.every((p) => typeof p === 'boolean')) return null;
  if (!Array.isArray(o.fields) || !Array.isArray(o.buildings) || !Array.isArray(o.animals)) return null;
  if (!o.fields.every(validField) || !o.buildings.every(validBuilding)) return null;
  const buildingIds = new Set(o.buildings.map((b) => (b as { id: string }).id));
  const ids = [...o.fields, ...o.buildings, ...o.animals].map((v) => (v as { id: string }).id);
  if (new Set(ids).size !== ids.length) return null; // views and actions find objects by id
  if (!o.animals.every((a) => validAnimal(a, buildingIds))) return null;
  if (!isObj(o.weather) || !oneOf(o.weather.kind, WEATHER_KINDS) || !isNum(o.weather.untilMs)) return null;
  if (!isBool(o.hasTractor) || !Array.isArray(o.ownedBreeds) || !o.ownedBreeds.every((b) => oneOf(b, BREED_IDS))
    || !oneOf(o.lastSeason, SEASONS)) return null;
  return o as unknown as GameState;
}

export function loadGame(store: Store, seed: number): GameState {
  let raw: string | null;
  try { raw = store.getItem(SAVE_KEY); } catch { return createInitialState(seed); }
  if (raw === null) return createInitialState(seed);
  const s = deserialize(raw);
  if (s) return s;
  try { store.setItem(CORRUPT_KEY, raw); } catch { /* ignore quota errors */ }
  return createInitialState(seed);
}

/** Never throws; returns false when the store rejects the write (quota, private mode). */
export function saveGame(store: Store, s: GameState): boolean {
  try { store.setItem(SAVE_KEY, serialize(s)); return true; } catch { return false; }
}

/** Uses the UTC calendar date (deterministic across time zones). */
export function exportFileName(date: Date): string {
  return `farma-kopia-${date.toISOString().slice(0, 10)}.json`;
}
