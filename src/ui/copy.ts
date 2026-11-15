/** Every player-visible string. Short labels only (spec 3.2: mało tekstu). */
import type { BreedId, BuildingKind, CropId, ItemId, Reason, SpeciesId } from '../core/types';

const ITEM: Record<ItemId, string> = {
  wheat: 'Pszenica', carrot: 'Marchew', corn: 'Kukurydza', pumpkin: 'Dynia', egg: 'Jajko', milk: 'Mleko',
};
const SPECIES: Record<SpeciesId, string> = { chicken: 'Kura', cow: 'Krowa', horse: 'Koń' };
const BREED: Record<BreedId, string> = { pony: 'Kuc', arabian: 'Arab', friesian: 'Fryz' };
const BUILDING: Record<BuildingKind, string> = { coop: 'Kurnik', barn: 'Obórka', stable: 'Stajnia' };

const REASON: Record<Exclude<Reason, 'locked'>, string> = {
  'no-money': 'Za mało monet',
  'out-of-season': 'Nie w tej porze',
  occupied: 'Zajęte',
  'not-ready': 'Jeszcze rośnie',
  full: 'Brak miejsca',
  'no-item': 'Brak w magazynie',
  sick: 'Najpierw weterynarz',
  young: 'Jeszcze młode',
  invalid: 'Nie da się',
};

export const T = {
  item: ITEM,
  crop: ITEM as Record<CropId, string>,
  species: SPECIES,
  breed: BREED,
  building: BUILDING,
  tractor: 'Traktor',
  parcel: 'Działka',
  field: 'Pole',
  upgradeItem: 'Rozbudowa',

  tool: { hand: 'Ręka', plant: 'Sadź', water: 'Podlej', harvest: 'Zbierz', tractor: 'Traktor', shop: 'Sklep' },

  buy: 'Kup',
  sell: 'Sprzedaj',
  feed: 'Nakarm',
  treat: 'Smakołyk',
  vet: 'Weterynarz',
  collect: 'Zbierz',
  upgrade: 'Rozbuduj',
  cancel: 'Anuluj',
  close: 'Zamknij',
  one: '1',
  five: '5',
  max: 'Max',
  all: 'Wszystko',
  owned: 'Masz',
  empty: 'Pusto',
  super: 'Super!',
  bought: 'Kupione!',
  plus: (n: number) => `+${n}`,
  times: (n: number) => `×${n}`,
  freeSeeds: (n: number) => `×${n} gratis`,
  closeMark: '✕',
  parent: {
    title: 'Menu rodzica',
    save: 'Zapisz kopię',
    load: 'Wczytaj kopię',
    newGame: 'Nowa gra',
    loaded: 'Wczytano',
    badFile: 'Zły plik',
    sure: 'Na pewno?',
    yesNew: 'Tak, nowa gra',
    levelUp: '+Poziom',
  },
  where: 'Gdzie?',
  placeHere: 'Stuknij na mapie',

  locked: (level: number) => `Od poziomu ${level}`,
  needFirst: (what: string) => `Najpierw: ${what}`,
  buildFirst: 'Najpierw zbuduj zagrodę',
  allUpgraded: 'Wszystko rozbudowane',
  reason(r: Reason, level = 0): string {
    return r === 'locked' ? T.locked(level) : REASON[r];
  },

  /** Name for an unlocksAt() key ('crop:carrot', 'building:coop', 'parcels', ...). */
  unlockName(key: string): string {
    const [kind, id] = key.split(':');
    switch (kind) {
      case 'crop': return ITEM[id as CropId];
      case 'building': return BUILDING[id as BuildingKind];
      case 'species': return SPECIES[id as SpeciesId];
      case 'breed': return BREED[id as BreedId];
      case 'parcels': return 'Działki';
      case 'tractor': return 'Traktor';
      case 'upgrade': return 'Rozbudowa';
      default: return '';
    }
  },
  levelUp: (level: number) => `Poziom ${level}!`,
  born: 'Urodziło się młode!',
  sick: 'Zwierzę zachorowało',
  safetyNet: 'Prezent: nasiona',
  safetyNetWinter: 'Prezent: pszenica i monety',
  gainXp: (n: number) => `+${n} XP`,
};
