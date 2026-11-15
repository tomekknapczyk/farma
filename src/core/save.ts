import { createInitialState } from './state';
import type { GameState } from './types';

export const SAVE_KEY = 'farma.save.v1';
export const CORRUPT_KEY = 'farma.save.corrupt';

type Store = Pick<Storage, 'getItem' | 'setItem'>;

const ITEM_IDS = ['wheat', 'carrot', 'corn', 'pumpkin', 'egg', 'milk'];
const CROP_IDS = ['wheat', 'carrot', 'corn', 'pumpkin'];

export function serialize(s: GameState): string {
  return JSON.stringify(s);
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const numRecord = (v: unknown, keys: string[]): boolean => isObj(v) && keys.every((k) => isNum(v[k]));

export function deserialize(json: string): GameState | null {
  let o: unknown;
  try { o = JSON.parse(json); } catch { return null; }
  if (!isObj(o) || o.version !== 1) return null;
  if (!isNum(o.timeMs) || !isNum(o.coins) || o.coins < 0 || !isNum(o.xp) || !isNum(o.level)
    || !isNum(o.nextId) || !isNum(o.safetyNetAtMs)) return null;
  if (!numRecord(o.storage, ITEM_IDS) || !numRecord(o.freeSeeds, CROP_IDS)) return null;
  if (!Array.isArray(o.parcels) || o.parcels.length !== 16 || !o.parcels.every((p) => typeof p === 'boolean')) return null;
  if (!Array.isArray(o.fields) || !Array.isArray(o.buildings) || !Array.isArray(o.animals)) return null;
  if (!isObj(o.weather) || typeof o.weather.kind !== 'string' || !isNum(o.weather.untilMs)) return null;
  if (typeof o.hasTractor !== 'boolean' || !Array.isArray(o.ownedBreeds) || typeof o.lastSeason !== 'string') return null;
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
