/** Shop modal (Kup / Sprzedaj) and placement mode for fields, buildings and parcels. */
import { buildBuilding, buyAnimal, capacity, upgradeBuilding } from '../core/animals';
import {
  BREEDS, BUILDINGS, CROPS, FIELD_COST, MAP_SIZE, PARCEL_LEVEL, PARCEL_SIZE, PRODUCTS, SPECIES, TRACTOR, UPGRADE,
} from '../core/config';
import { buildField } from '../core/crops';
import { sell } from '../core/economy';
import { buyHorse } from '../core/horses';
import { buyParcel, canPlace, nextParcelCost, parcelOf } from '../core/map';
import { buyTractor } from '../core/tractor';
import type { ActionResult, BreedId, Building, BuildingKind, GameState, ItemId } from '../core/types';
import type { GameController } from '../game/controller';
import type { FarmScene, Placement, PlacementZone } from '../game/FarmScene';
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

  const done = (r: ActionResult, level: number): boolean => {
    const ok = report(r, level);
    if (ok) showToast(T.bought, 'good');
    return ok;
  };

  const renderTabs = (into: HTMLElement) => {
    into.append(el('div', 'tabs',
      btn({ label: T.buy, cls: 'tab', active: tab === 'buy', onTap: () => { tab = lastTab = 'buy'; view.refresh(); } }),
      btn({ label: T.sell, cls: 'tab', active: tab === 'sell', onTap: () => { tab = lastTab = 'sell'; choice = null; view.refresh(); } }),
    ));
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
    grid.append(card({
      icon: 'icon-parcel', label: T.parcel, sub: cost(nextParcelCost(s)), lockedAt: lockAt(PARCEL_LEVEL),
      onTap: () => openParcelPlacement(controller, scene),
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
      if (c.kind === 'upgrade') {
        // nothing to upgrade: either no building yet, or every building is already upgraded
        showToast(controller.state.buildings.length === 0 ? T.buildFirst : T.allUpgraded, 'error');
      } else {
        const need: BuildingKind = c.kind === 'animal' ? SPECIES[c.species].building : 'stable';
        showToast(T.needFirst(T.building[need]), 'error');
      }
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
  // tabs live inside the re-rendered target so the press guard covers them too
  const view = live((fn) => controller.subscribe(fn), key, m.body, (into) => {
    renderTabs(into);
    const content = el('div', 'shop-content');
    into.append(content);
    if (tab === 'buy') buyGrid(content); else sellList(content);
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

/** With `p.confirm` the bar gets a "Postaw" button, grey until a valid spot has been picked. */
function startPlacement(scene: FarmScene, iconKey: string, p: Placement): () => void {
  closeModal();
  const root = getUiRoot();
  const end = () => {
    scene.setPlacement(null);
    bar.remove();
    root.classList.remove('placing');
  };
  const label = el('span', 'place-label', T.placeHere);
  const ok = p.confirm
    ? btn({ label: T.placeOk, cls: 'ok off', onTap: () => { if (!scene.confirmPlacement()) showToast(T.placeHere); } })
    : null;
  const bar = el('div', 'place-bar', icon(iconKey, 'place-icon'), label, ok,
    btn({ label: T.cancel, cls: 'cancel', onTap: end }));
  root.querySelector('.place-bar')?.remove();
  root.append(bar);
  root.classList.add('placing');
  scene.setPlacement(!ok ? p : {
    ...p,
    onPick: (pick) => {
      label.textContent = pick ? T.placeAgain : T.placeHere;
      ok.classList.toggle('off', !pick?.ok);
      p.onPick?.(pick);
    },
  });
  return end;
}

/** Parcel purchase from the shop card or a tapped lock (`parcel` = that parcel, previewed at once). */
export function openParcelPlacement(controller: GameController, scene: FarmScene, parcel?: number): void {
  if (controller.state.level < PARCEL_LEVEL) { showToast(T.locked(PARCEL_LEVEL), 'error'); return; }
  placeParcel(controller, scene);
  if (parcel === undefined) return;
  const perRow = MAP_SIZE / PARCEL_SIZE;
  scene.previewAt((parcel % perRow) * PARCEL_SIZE + 1, Math.floor(parcel / perRow) * PARCEL_SIZE + 1);
}

/** Fields: one tap places (cheap, 1x1); stays in placement so several can be laid in a row; "Anuluj" ends it. */
function placeField(controller: GameController, scene: FarmScene): void {
  startPlacement(scene, 'field-dry', {
    w: 1, h: 1,
    valid: (x, y) => canPlace(controller.state, x, y, 1, 1) && controller.state.coins >= FIELD_COST,
    onPlace: (x, y) => { report(controller.act(buildField, x, y)); },
  });
}

/** Buildings: two steps (tap shows the ghost, second tap or "Postaw" builds), see Placement.confirm. */
function placeBuilding(controller: GameController, scene: FarmScene, kind: BuildingKind): void {
  const level = BUILDINGS[kind].level;
  const end = startPlacement(scene, `bld-${kind}`, {
    w: 2, h: 2, texture: `bld-${kind}`, confirm: true,
    valid: (x, y) => canPlace(controller.state, x, y, 2, 2) && controller.state.coins >= BUILDINGS[kind].cost,
    onPlace: (x, y) => {
      if (report(controller.act(buildBuilding, kind, x, y), level)) { end(); showToast(T.bought, 'good'); }
    },
  });
}

function placeParcel(controller: GameController, scene: FarmScene): void {
  // dry run on a copy: buyParcel owns the adjacency, level and price rules
  const dryRun = (index: number, coins?: number) => {
    const copy = structuredClone(controller.state);
    if (coins !== undefined) copy.coins = coins;
    return buyParcel(copy, { rng: { next: () => 0 }, events: [] }, index).ok;
  };
  const perRow = MAP_SIZE / PARCEL_SIZE;
  const zones = (): PlacementZone[] => {
    const out: PlacementZone[] = [];
    controller.state.parcels.forEach((owned, i) => {
      if (owned || !dryRun(i, Number.MAX_SAFE_INTEGER)) return; // not adjacent (or locked)
      out.push({
        x: (i % perRow) * PARCEL_SIZE, y: Math.floor(i / perRow) * PARCEL_SIZE, w: PARCEL_SIZE, h: PARCEL_SIZE,
        kind: dryRun(i) ? 'ok' : 'expensive',
      });
    });
    return out;
  };
  const end = startPlacement(scene, 'icon-parcel', {
    w: PARCEL_SIZE, h: PARCEL_SIZE, snap: PARCEL_SIZE,
    valid: (x, y) => dryRun(parcelOf(x, y)),
    zones,
    onPlace: (x, y) => {
      if (report(controller.act(buyParcel, parcelOf(x, y)), PARCEL_LEVEL)) { end(); showToast(T.bought, 'good'); }
    },
  });
}
