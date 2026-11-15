import type { BreedId, BuildingKind, CropId, ProductId, Season, SpeciesId, WeatherKind } from './types';

export const MAP_SIZE = 16;
export const PARCEL_SIZE = 4;
export const START_PARCEL = 5; // px=1, py=1
export const START_COINS = 50;
export const START_FIELDS: ReadonlyArray<readonly [number, number]> = [[5, 5], [6, 5], [5, 6], [6, 6]];

export interface CropDef {
  level: number; seasons: Season[]; growMs: number; seed: number; yield: number; price: number; feed: number;
}
export const CROPS: Record<CropId, CropDef> = {
  wheat: { level: 1, seasons: ['spring', 'summer', 'autumn'], growMs: 30000, seed: 5, yield: 3, price: 4, feed: 1 },
  carrot: { level: 2, seasons: ['spring', 'summer', 'autumn'], growMs: 45000, seed: 8, yield: 3, price: 6, feed: 1 },
  corn: { level: 4, seasons: ['summer'], growMs: 75000, seed: 15, yield: 4, price: 9, feed: 2 },
  pumpkin: { level: 6, seasons: ['summer', 'autumn'], growMs: 120000, seed: 25, yield: 2, price: 30, feed: 0 },
};
export const LOW_YIELD_FACTOR = 0.4; // yield = max(1, round(yield * 0.4))

export interface ProductDef { price: number; }
export const PRODUCTS: Record<ProductId, ProductDef> = {
  egg: { price: 8 },
  milk: { price: 25 },
};

export interface SpeciesDef {
  level: number; cost: number | null; building: BuildingKind; needFeed: number; cycleMs: number;
  product: ProductId | null; youngMs: number; vet: number;
}
export const SPECIES: Record<SpeciesId, SpeciesDef> = {
  chicken: { level: 3, cost: 40, building: 'coop', needFeed: 1, cycleMs: 40000, product: 'egg', youngMs: 120000, vet: 15 },
  cow: { level: 5, cost: 150, building: 'barn', needFeed: 2, cycleMs: 90000, product: 'milk', youngMs: 180000, vet: 40 },
  horse: { level: 7, cost: null, building: 'stable', needFeed: 2, cycleMs: 120000, product: null, youngMs: 300000, vet: 60 },
};

export interface BreedDef { level: number; cost: number; sale: number; }
export const BREEDS: Record<BreedId, BreedDef> = {
  pony: { level: 7, cost: 300, sale: 250 },
  arabian: { level: 8, cost: 600, sale: 500 },
  friesian: { level: 10, cost: 1000, sale: 800 },
};

export interface BuildingDef { level: number; cost: number; cap: number; capUp: number; feeds: CropId[]; }
export const BUILDINGS: Record<BuildingKind, BuildingDef> = {
  coop: { level: 3, cost: 60, cap: 4, capUp: 8, feeds: ['wheat'] },
  barn: { level: 5, cost: 200, cap: 3, capUp: 6, feeds: ['wheat', 'corn'] },
  stable: { level: 7, cost: 400, cap: 3, capUp: 6, feeds: ['carrot', 'corn'] },
};
export const UPGRADE: { level: number; cost: Record<BuildingKind, number> } = {
  level: 9,
  cost: { coop: 150, barn: 300, stable: 500 },
};
export const TROUGH_CAP = 10;
export const TROUGH_CAP_UP = 20;

export const SICK_CHANCE = 0.03;
export const BIRTH_CHANCE = 0.10;
export const BIRTH_CHANCE_TREAT = 0.20;
export const TREAT_SPEED = 2;

export const FIELD_COST = 10;
export const PARCEL_LEVEL = 2;
/** bought = number of purchased parcels so far */
export function parcelCost(bought: number): number {
  return Math.round(100 * Math.pow(1.5, bought));
}

export const TRACTOR = { level: 8, cost: 500, rowLength: 4 };

export const XP = { plant: 1, harvest: 2, collect: 2, treat: 1, sellHorse: 10, buy: 5 };
export const MAX_LEVEL = 10;
export function xpToNext(level: number): number {
  return Math.round(30 * Math.pow(1.6, level - 1));
}

export const SEASON_MS = 3600000;
export const TRANSITION_MS = 300000;

export const WEATHER_TABLE: Record<Season, Partial<Record<WeatherKind, number>>> = {
  spring: { sun: 0.55, rain: 0.45 },
  summer: { sun: 0.6, rain: 0.15, heat: 0.25 },
  autumn: { sun: 0.5, rain: 0.5 },
  winter: { sun: 0.5, snow: 0.5 },
};
export const WEATHER_MIN_MS = 180000;
export const WEATHER_MAX_MS = 300000;
export const HEAT_GROWTH = 1.2;

export const SAFETY_NET = { checkMs: 60000, seeds: 4, winterWheat: 5, winterCoins: 20 };
export const MAX_DT_MS = 1000;
