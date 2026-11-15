/** Building panel (trough, feeding, animals, upgrade) and animal panel (status, collect, treat, vet, sell). */
import {
  animalStatus, callVet, capacity, collectProduct, fillTrough, giveTreat, troughCap, upgradeBuilding,
} from '../core/animals';
import { BREEDS, BUILDINGS, SPECIES, UPGRADE } from '../core/config';
import { sellHorse } from '../core/horses';
import type { BreedId, Building, CropId, GameState } from '../core/types';
import type { GameController } from '../game/controller';
import type { FarmScene } from '../game/FarmScene';
import { statusIcon } from '../game/render/animalArt';
import { T } from './copy';
import { btn, el, live, openModal, price } from './dom';
import { animalIcon, icon, itemIcon } from './icons';
import { report, showToast } from './toast';

const FEED_STEPS = [[1, T.one], [5, T.five]] as const;

export function openBuildingPanel(controller: GameController, scene: FarmScene, buildingId: string): void {
  const b0 = controller.state.buildings.find((v) => v.id === buildingId);
  if (!b0) return;
  const m = openModal(T.building[b0.kind], `bld-${b0.kind}`);
  let feeding = false;

  const key = () => {
    const s = controller.state;
    const b = s.buildings.find((v) => v.id === buildingId);
    const animals = s.animals.filter((a) => a.buildingId === buildingId).map((a) => [a.id, animalStatus(a), a.breed]);
    return JSON.stringify([feeding, b, animals, s.storage, s.level, s.coins >= UPGRADE.cost[b0.kind], s.ownedBreeds]);
  };
  const view = live((fn) => controller.subscribe(fn), key, m.body, (into) => {
    const s = controller.state;
    const b = s.buildings.find((v) => v.id === buildingId);
    if (!b) { m.close(); return; }
    const animals = s.animals.filter((a) => a.buildingId === b.id);
    const cap = troughCap(b);

    into.append(el('div', 'row trough',
      icon(b.trough > 0 ? 'trough-full' : 'trough-empty', 'row-icon wide'),
      meter(b.trough / cap),
      el('span', 'row-count', `${b.trough}/${cap}`),
      btn({ icon: 'icon-hungry', label: T.feed, active: feeding, onTap: () => { feeding = !feeding; view.refresh(); } }),
    ));
    if (feeding) into.append(feedChooser(controller, b));

    const herd = el('div', 'herd');
    for (const a of animals) {
      const st = statusIcon(a);
      const card = btn({ icon: animalIcon(a), cls: 'animal', onTap: () => openAnimalPanel(controller, scene, a.id) });
      if (st) card.append(icon(st, 'status-badge'));
      herd.append(card);
    }
    into.append(el('div', 'section-head', icon(SPECIES_ICON[b.kind], 'row-icon'), `${animals.length}/${capacity(b)}`), herd);

    if (b.kind === 'stable') into.append(breedCollection(s));

    if (!b.upgraded) {
      into.append(btn({
        icon: 'icon-upgrade', label: T.upgrade, cls: 'wide-btn', sub: price(UPGRADE.cost[b.kind]),
        lockedAt: s.level < UPGRADE.level ? UPGRADE.level : undefined,
        onTap: () => { if (report(controller.act(upgradeBuilding, b.id), UPGRADE.level)) showToast(T.bought, 'good'); },
      }));
    }
  });
  m.onClose(view.stop);
}

const SPECIES_ICON: Record<Building['kind'], string> = { coop: 'chicken', barn: 'cow', stable: 'horse-pony' };

function feedChooser(controller: GameController, b: Building): HTMLElement {
  const s = controller.state;
  const box = el('div', 'feed');
  for (const f of BUILDINGS[b.kind].feeds as CropId[]) {
    const fill = (n: number) => { report(controller.act(fillTrough, b.id, f, n)); };
    box.append(el('div', 'row',
      icon(itemIcon(f), 'row-icon'),
      el('span', 'row-count', T.times(s.storage[f])),
      el('span', 'spacer'),
      ...FEED_STEPS.map(([n, label]) => btn({ label, cls: 'small', onTap: () => fill(n) })),
      btn({ label: T.max, cls: 'small', onTap: () => fill(Math.max(1, controller.state.storage[f])) }),
    ));
  }
  return box;
}

export function openAnimalPanel(controller: GameController, scene: FarmScene, animalId: string): void {
  const a0 = controller.state.animals.find((v) => v.id === animalId);
  if (!a0) return;
  const title = a0.breed ? T.breed[a0.breed] : T.species[a0.species];
  const m = openModal(title, animalIcon(a0));

  const key = () => {
    const s = controller.state;
    const a = s.animals.find((v) => v.id === animalId);
    return JSON.stringify([a && [animalStatus(a), a.treat, a.youngMsLeft > 0], s.storage.carrot, s.coins, s.ownedBreeds]);
  };
  const view = live((fn) => controller.subscribe(fn), key, m.body, (into) => {
    const s = controller.state;
    const a = s.animals.find((v) => v.id === animalId);
    if (!a) { m.close(); return; }
    const def = SPECIES[a.species];
    const st = statusIcon(a) ?? (a.treat ? 'icon-heart' : null);
    into.append(el('div', 'animal-hero', icon(animalIcon(a), 'hero'), st ? icon(st, 'hero-status') : null));

    const actions = el('div', 'actions');
    if (def.product) {
      actions.append(btn({
        icon: itemIcon(def.product), label: T.collect, disabled: !a.productReady,
        onTap: () => { report(controller.act(collectProduct, a.id)); },
      }));
    }
    actions.append(btn({
      icon: 'crop-carrot-3', label: T.treat, sub: T.times(s.storage.carrot), disabled: a.treat,
      onTap: () => { report(controller.act(giveTreat, a.id)); },
    }));
    actions.append(btn({
      icon: 'icon-sick', label: T.vet, sub: price(def.vet, s.coins < def.vet ? 'short' : ''), disabled: !a.sick,
      onTap: () => { report(controller.act(callVet, a.id)); },
    }));
    if (a.species === 'horse' && a.breed) {
      actions.append(btn({
        icon: 'icon-coin', label: T.sell, sub: price(BREEDS[a.breed].sale),
        onTap: () => { if (report(controller.act(sellHorse, a.id))) m.close(); },
      }));
    }
    const building = s.buildings.find((v) => v.id === a.buildingId);
    if (building) {
      actions.append(btn({ icon: `bld-${building.kind}`, cls: 'wide-icon', onTap: () => openBuildingPanel(controller, scene, building.id) }));
    }
    into.append(actions);
    if (a.species === 'horse') into.append(breedCollection(s));
  });
  m.onClose(view.stop);
}

/** Owned breeds in colour, the rest as grey silhouettes (no text). */
function breedCollection(s: GameState): HTMLElement {
  const row = el('div', 'collection');
  for (const b of Object.keys(BREEDS) as BreedId[]) {
    row.append(icon(`horse-${b}`, s.ownedBreeds.includes(b) ? 'breed' : 'breed silhouette'));
  }
  return row;
}

function meter(frac: number): HTMLElement {
  const fill = el('div', 'meter-fill');
  fill.style.width = `${Math.round(Math.min(1, Math.max(0, frac)) * 100)}%`;
  return el('div', 'meter', fill);
}
