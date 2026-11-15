import { PARCEL_SIZE, MAP_SIZE, START_COINS, START_FIELDS, START_PARCEL } from './config';
import type { GameState } from './types';

export function createInitialState(_seed: number): GameState {
  const parcels = new Array<boolean>((MAP_SIZE / PARCEL_SIZE) ** 2).fill(false);
  parcels[START_PARCEL] = true;
  const s: GameState = {
    version: 1,
    timeMs: 0,
    coins: START_COINS,
    xp: 0,
    level: 1,
    storage: { wheat: 0, carrot: 0, corn: 0, pumpkin: 0, egg: 0, milk: 0 },
    freeSeeds: { wheat: 0, carrot: 0, corn: 0, pumpkin: 0 },
    parcels,
    fields: [],
    buildings: [],
    animals: [],
    weather: { kind: 'sun', untilMs: 180000 },
    hasTractor: false,
    ownedBreeds: [],
    nextId: 1,
    safetyNetAtMs: 60000,
    lastSeason: 'spring',
  };
  for (const [x, y] of START_FIELDS) {
    s.fields.push({ id: newId(s, 'f'), x, y, crop: null, growthMs: 0, watered: false });
  }
  return s;
}

export function newId(s: GameState, prefix: string): string {
  return prefix + s.nextId++;
}
