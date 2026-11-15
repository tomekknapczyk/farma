export type CropId = 'wheat' | 'carrot' | 'corn' | 'pumpkin';
export type ProductId = 'egg' | 'milk';
export type ItemId = CropId | ProductId;
export type SpeciesId = 'chicken' | 'cow' | 'horse';
export type BreedId = 'pony' | 'arabian' | 'friesian';
export type BuildingKind = 'coop' | 'barn' | 'stable';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type WeatherKind = 'sun' | 'rain' | 'heat' | 'snow';

export interface Field { id: string; x: number; y: number; crop: CropId | null; growthMs: number; watered: boolean; }
export interface Building { id: string; kind: BuildingKind; x: number; y: number; upgraded: boolean; trough: number; } // trough = feed points; occupies 2x2 from (x,y)
export interface Animal {
  id: string; species: SpeciesId; breed: BreedId | null; buildingId: string;
  youngMsLeft: number;      // >0 = young, does not produce
  sick: boolean;
  cycleMs: number;          // progress of current cycle; -1 = cycle not started (waiting for feed)
  productReady: boolean;    // chicken/cow only
  treat: boolean;           // treat active until end of cycle
  bornOnFarm: boolean;
}
export interface GameState {
  version: 1; timeMs: number; coins: number; xp: number; level: number;
  storage: Record<ItemId, number>;
  freeSeeds: Record<CropId, number>;
  parcels: boolean[];                 // 16 parcels 4x4, index = py*4+px
  fields: Field[]; buildings: Building[]; animals: Animal[];
  weather: { kind: WeatherKind; untilMs: number };
  hasTractor: boolean;
  ownedBreeds: BreedId[];             // collection
  nextId: number;
  safetyNetAtMs: number;              // next check
  lastSeason: Season;                 // for seasonChanged event
}
export type Reason = 'no-money' | 'locked' | 'out-of-season' | 'occupied' | 'not-ready' | 'full'
  | 'invalid' | 'sick' | 'young' | 'no-item';
export type ActionResult = { ok: true; n?: number } | { ok: false; reason: Reason };
export type GameEvent =
  | { type: 'levelUp'; level: number }
  | { type: 'born'; animalId: string }
  | { type: 'sick'; animalId: string }
  | { type: 'seasonChanged'; season: Season }
  | { type: 'weatherChanged'; kind: WeatherKind }
  | { type: 'safetyNet' }
  /** x, y = tile the gain floats from; `animalId` = the animal it came from (the float starts at its sprite). */
  | { type: 'gain'; x: number; y: number; coins?: number; xp?: number; item?: ItemId; qty?: number; animalId?: string };
export interface Rng { next(): number } // [0,1)
export interface Ctx { rng: Rng; events: GameEvent[] }
