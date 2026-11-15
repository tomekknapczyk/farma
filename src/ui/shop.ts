/** Shop modal (Kup / Sprzedaj) and placement mode for fields, buildings and parcels. */
import { buildBuilding, buyAnimal, capacity, upgradeBuilding } from '../core/animals';
import {
  BREEDS, BUILDINGS, CROPS, FIELD_COST, PARCEL_LEVEL, PARCEL_SIZE, PRODUCTS, SPECIES, TRACTOR, UPGRADE, parcelCost,
} from '../core/config';
import { buildField } from '../core/crops';
import { sell } from '../core/economy';
import { buyHorse } from '../core/horses';
import { buyParcel, canPlace, parcelOf } from '../core/map';
import { buyTractor } from '../core/tractor';
import type { ActionResult, BreedId, Building, BuildingKind, GameState, ItemId } from '../core/types';
import type { GameController } from '../game/controller';
import type { FarmScene, Placement } from '../game/FarmScene';
import { T } from './copy';
import { btn, closeModal, el, getUiRoot, live, openModal, price } from './dom';
import { icon, itemIcon } from './icons';
import { report, showToast } from './toast';

type Tab = 'buy' | 'sell';
/** A purchase that needs a building chosen first (animals, horses, upgrades). */
type Choice =
  | { kind: 'animal'; species: 'chicken' | 'cow' }
  | { kind: 'horse'; breed: BreedId }
  | { kind: 'upgrade' };

const ITEMS: ItemId[] = ['wheat', 'carrot', 'corn', 'pumpkin', 'egg', 'milk'];
let lastTab: Tab = 'buy';

export function openShop(controller: GameController, scene: FarmScene): void {
  let tab: Tab = lastTab;
  let choice: Choice | null = null;
  const m = openModal(T.tool.shop, 'icon-shop');
  const tabs = el('div', 'tabs');
  const content = el('div', 'shop-content');
  m.body.append(tabs, content);

  const done = (r: ActionResult, level: number): boolean => {
    const ok = report(r, level);
    if (ok) showToast(T.bought, 'good');
    return ok;
  };

  const renderTabs = () => {
    tabs.replaceChildren(
      btn({ label: T.buy, cls: 'tab', active: tab === 'buy', onTap: () => { tab = lastTab = 'buy'; view.refresh(); } }),
      btn({ label: T.sell, cls: 'tab', active: tab === 'sell', onTap: () => { tab = lastTab = 'sell'; choice = null; view.refresh(); } }),
    );
  };

  const buyGrid = (into: HTMLElement) => {
    const s = controller.state;
    const lvl = s.level;
    const lockAt = (need: number) => (lvl < need ? need : undefined);
    const card = (o: Parameters<typeof btn>[0]) => btn({ ...o, cls: `card ${o.cls ?? ''}` });
    const cost = (n: number) => price(n, s.coins < n ? 'short' : '');
    const locked = (need: number, go: () => void) => () => {
      if (lvl < need) showToast(T.locked(need), 'error');
      else go();
    };

    if (choice) into.append(chooser(choice));

    const grid = el('div', 'grid');
    grid.append(card({
      icon: 'field-dry', label: T.field, sub: cost(FIELD_COST),
      onTap: () => placeField(controller, scene),
    }));
    const bought = s.parcels.filter(Boolean).length - 1;
    grid.append(card({
      icon: 'icon-parcel', label: T.parcel, sub: cost(parcelCost(bought)), lockedAt: lockAt(PARCEL_LEVEL),
      onTap: locked(PARCEL_LEVEL, () => placeParcel(controller, scene)),
    }));
    for (const k of Object.keys(BUILDINGS) as BuildingKind[]) {
      const d = BUILDINGS[k];
      grid.append(card({
        icon: `bld-${k}`, label: T.building[k], sub: cost(d.cost), lockedAt: lockAt(d.level), cls: 'wide-icon',
        onTap: locked(d.level, () => placeBuilding(controller, scene, k)),
      }));
    }
    for (const sp of ['chicken', 'cow'] as const) {
      const d = SPECIES[sp];
      grid.append(card({
        icon: sp, label: T.species[sp], sub: cost(d.cost ?? 0), lockedAt: lockAt(d.level),
        onTap: locked(d.level, () => choose({ kind: 'animal', species: sp })),
      }));
    }
    for (const b of Object.keys(BREEDS) as BreedId[]) {
      const d = BREEDS[b];
      grid.append(card({
        icon: `horse-${b}`, label: T.breed[b], sub: cost(d.cost), lockedAt: lockAt(d.level),
        onTap: locked(d.level, () => choose({ kind: 'horse', breed: b })),
      }));
    }
    grid.append(card({
      icon: 'tractor', label: T.tractor, sub: s.hasTractor ? T.owned : cost(TRACTOR.cost),
      lockedAt: s.hasTractor ? undefined : lockAt(TRACTOR.level), disabled: s.hasTractor,
      onTap: locked(TRACTOR.level, () => { done(controller.act(buyTractor), TRACTOR.level); }),
    }));
    grid.append(card({
      icon: 'icon-upgrade', label: T.upgradeItem, lockedAt: lockAt(UPGRADE.level),
      onTap: locked(UPGRADE.level, () => choose({ kind: 'upgrade' })),
    }));
    into.append(grid);
  };

  /** Animals/horses/upgrades need a building: buy straight away when there is exactly one candidate. */
  const choose = (c: Choice) => {
    const list = candidates(controller.state, c);
    if (list.length === 0) {
      const need: BuildingKind = c.kind === 'animal' ? SPECIES[c.species].building : c.kind === 'horse' ? 'stable' : 'coop';
      showToast(c.kind === 'upgrade' ? T.reason('invalid') : T.needFirst(T.building[need]), 'error');
      return;
    }
    if (list.length === 1) { buyIn(c, list[0]); return; }
    choice = c;
    view.refresh();
  };

  const buyIn = (c: Choice, b: Building) => {
    if (c.kind === 'animal') done(controller.act(buyAnimal, c.species, b.id), SPECIES[c.species].level);
    else if (c.kind === 'horse') done(controller.act(buyHorse, c.breed, b.id), BREEDS[c.breed].level);
    else if (done(controller.act(upgradeBuilding, b.id), UPGRADE.level)) choice = null;
    view.refresh();
  };

  const chooser = (c: Choice) => {
    const s = controller.state;
    const row = el('div', 'chooser', el('span', 'chooser-title', T.where));
    for (const b of candidates(s, c)) {
      const n = s.animals.filter((a) => a.buildingId === b.id).length;
      row.append(btn({
        icon: `bld-${b.kind}`, cls: 'wide-icon',
        sub: c.kind === 'upgrade' ? price(UPGRADE.cost[b.kind]) : `${n}/${capacity(b)}`,
        onTap: () => buyIn(c, b),
      }));
    }
    row.append(btn({ label: T.cancel, cls: 'cancel', onTap: () => { choice = null; view.refresh(); } }));
    return row;
  };

  const sellList = (into: HTMLElement) => {
    const s = controller.state;
    const have = ITEMS.filter((i) => s.storage[i] > 0);
    if (have.length === 0) { into.append(el('div', 'empty', T.empty)); return; }
    for (const item of have) {
      const unit = item in CROPS ? CROPS[item as keyof typeof CROPS].price : PRODUCTS[item as keyof typeof PRODUCTS].price;
      const sellN = (n: number) => {
        const r = controller.act(sell, item, n);
        if (report(r) && r.ok) showToast(T.plus(r.n ?? 0), 'good');
      };
      into.append(el('div', 'row',
        icon(itemIcon(item), 'row-icon'),
        el('span', 'row-count', T.times(s.storage[item])),
        price(unit),
        el('span', 'spacer'),
        btn({ label: T.one, cls: 'small', onTap: () => sellN(1) }),
        btn({ label: T.all, cls: 'small', onTap: () => sellN(controller.state.storage[item]) }),
      ));
    }
  };

  const key = () => {
    const s = controller.state;
    return JSON.stringify([tab, choice, s.coins, s.level, s.storage, s.hasTractor, s.parcels,
      s.buildings.map((b) => [b.id, b.upgraded]), s.animals.length]);
  };
  const view = live((fn) => controller.subscribe(fn), key, content, (into) => {
    renderTabs();
    if (tab === 'buy') buyGrid(into); else sellList(into);
  });
  m.onClose(view.stop);
}

function candidates(s: GameState, c: Choice): Building[] {
  if (c.kind === 'upgrade') return s.buildings.filter((b) => !b.upgraded);
  const kind = c.kind === 'animal' ? SPECIES[c.species].building : 'stable';
  return s.buildings.filter((b) => b.kind === kind);
}

// -------------------------------------------------------------------------------------------------
// Placement mode
// -------------------------------------------------------------------------------------------------

function startPlacement(scene: FarmScene, iconKey: string, p: Placement): () => void {
  closeModal();
  const root = getUiRoot();
  const end = () => {
    scene.setPlacement(null);
    bar.remove();
    root.classList.remove('placing');
  };
  const bar = el('div', 'place-bar', icon(iconKey, 'place-icon'), el('span', 'place-label', T.placeHere),
    btn({ label: T.cancel, cls: 'cancel', onTap: end }));
  root.querySelector('.place-bar')?.remove();
  root.append(bar);
  root.classList.add('placing');
  scene.setPlacement(p);
  return end;
}

/** Fields: stays in placement so several can be laid in a row; "Anuluj" ends it. */
function placeField(controller: GameController, scene: FarmScene): void {
  startPlacement(scene, 'field-dry', {
    w: 1, h: 1,
    valid: (x, y) => canPlace(controller.state, x, y, 1, 1) && controller.state.coins >= FIELD_COST,
    onPlace: (x, y) => { report(controller.act(buildField, x, y)); },
  });
}

function placeBuilding(controller: GameController, scene: FarmScene, kind: BuildingKind): void {
  const level = BUILDINGS[kind].level;
  const end = startPlacement(scene, `bld-${kind}`, {
    w: 2, h: 2, texture: `bld-${kind}`,
    valid: (x, y) => canPlace(controller.state, x, y, 2, 2) && controller.state.coins >= BUILDINGS[kind].cost,
    onPlace: (x, y) => {
      if (report(controller.act(buildBuilding, kind, x, y), level)) { end(); showToast(T.bought, 'good'); }
    },
  });
}

function placeParcel(controller: GameController, scene: FarmScene): void {
  // dry run on a copy: buyParcel owns the adjacency, level and price rules
  const wouldBuy = (x: number, y: number) =>
    buyParcel(structuredClone(controller.state), { rng: { next: () => 0 }, events: [] }, parcelOf(x, y)).ok;
  const end = startPlacement(scene, 'icon-parcel', {
    w: PARCEL_SIZE, h: PARCEL_SIZE, snap: PARCEL_SIZE,
    valid: wouldBuy,
    onPlace: (x, y) => {
      if (report(controller.act(buyParcel, parcelOf(x, y)), PARCEL_LEVEL)) { end(); showToast(T.bought, 'good'); }
    },
  });
}
