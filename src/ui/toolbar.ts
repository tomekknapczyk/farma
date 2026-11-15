/** Bottom bar: tools, crop picker for "Sadź", and routing of map taps to core actions. */
import { collectProduct } from '../core/animals';
import { CROPS, TRACTOR } from '../core/config';
import { canPlantNow, harvest, isReady, plant, water } from '../core/crops';
import { tileOccupant } from '../core/map';
import { useTractor } from '../core/tractor';
import type { CropId } from '../core/types';
import type { GameController } from '../game/controller';
import { EV_DRAG_START, EV_OBJECT_TAP, EV_TILE_DRAG, EV_TILE_TAP, type FarmScene, type ObjectTap, type Tool } from '../game/FarmScene';
import { T } from './copy';
import { btn, el, live, price } from './dom';
import { openAnimalPanel, openBuildingPanel } from './panels';
import { openParcelPlacement, openShop } from './shop';
import { report, showToast } from './toast';

const TOOL_ICON: Record<Tool, string> = {
  hand: 'icon-hand', plant: 'icon-seed', water: 'icon-water', harvest: 'icon-sickle', tractor: 'tractor',
};

export function mountToolbar(root: HTMLElement, controller: GameController, scene: FarmScene): void {
  let crop: CropId = 'wheat';
  const bar = el('div', 'toolbar');
  root.append(bar);

  const setTool = (t: Tool) => {
    scene.currentTool = t;
    view.refresh();
  };

  const key = () => {
    const s = controller.state;
    // coins only matter for the red "can't afford" seed prices
    const short = (Object.keys(CROPS) as CropId[]).map((c) => s.coins < CROPS[c].seed);
    return [scene.currentTool, crop, s.hasTractor, canPlantKey(controller), short, Object.values(s.freeSeeds)].join('|');
  };

  const render = (into: HTMLElement) => {
    const s = controller.state;
    if (scene.currentTool === 'tractor' && !s.hasTractor) scene.currentTool = 'hand';
    const list: Tool[] = ['hand', 'plant', 'water', 'harvest'];
    if (s.hasTractor) list.push('tractor');

    if (scene.currentTool === 'plant') {
      const picker = el('div', 'picker');
      for (const c of Object.keys(CROPS) as CropId[]) {
        const can = canPlantNow(s, c);
        const free = s.freeSeeds[c];
        const locked = !can.ok && can.reason === 'locked';
        picker.append(btn({
          icon: `crop-${c}-3`,
          label: T.crop[c],
          sub: free > 0 ? T.freeSeeds(free) : price(CROPS[c].seed, s.coins < CROPS[c].seed ? 'short' : ''),
          lockedAt: locked ? CROPS[c].level : undefined,
          cls: `crop${!can.ok && !locked ? ' off' : ''}`,
          active: c === crop,
          onTap: () => {
            if (!can.ok) { report(can, CROPS[c].level); return; }
            crop = c;
            view.refresh();
          },
        }));
      }
      into.append(picker);
    }
    into.append(el('div', 'tools',
      ...list.map((t) => btn({ icon: TOOL_ICON[t], label: T.tool[t], active: scene.currentTool === t, cls: 'tool', onTap: () => setTool(t) })),
      btn({ icon: 'icon-shop', label: T.tool.shop, cls: 'tool shop', onTap: () => openShop(controller, scene) }),
    ));
  };

  let collected = new Set<string>(); // animals collected during the current drag (each once)

  const onTile = (x: number, y: number, drag: boolean) => {
    const s = controller.state;
    const tool = scene.currentTool;
    if (tool === 'tractor') {
      const occ = tileOccupant(s, x, y);
      if (drag && occ?.kind !== 'field') return;
      const r = controller.act(useTractor, x, y);
      if (!(drag && !r.ok && r.reason === 'invalid')) report(r, TRACTOR.level);
      return;
    }
    const occ = tileOccupant(s, x, y);
    if (drag && occ?.kind === 'building' && (tool === 'hand' || tool === 'harvest')) {
      // drag-to-collect (spec 4.3): sweeping over a pen collects every ready product in it
      const ready = s.animals.filter((a) => a.buildingId === occ.building.id && a.productReady && !collected.has(a.id));
      for (const a of ready) {
        collected.add(a.id);
        report(controller.act(collectProduct, a.id));
      }
      return;
    }
    if (occ?.kind !== 'field') {
      if (!drag && tool !== 'hand') showToast(T.reason('invalid'), 'error');
      return;
    }
    const f = occ.field;
    switch (tool) {
      case 'hand':
        if (!drag && isReady(f)) report(controller.act(harvest, f.id));
        break;
      case 'plant':
        if (f.crop !== null) { if (!drag) showToast(T.reason('occupied'), 'error'); break; }
        report(controller.act(plant, f.id, crop), CROPS[crop].level);
        break;
      case 'water':
        if (drag && (f.crop === null || f.watered || isReady(f))) break;
        report(controller.act(water, f.id));
        break;
      case 'harvest':
        if (drag && !isReady(f)) break;
        report(controller.act(harvest, f.id));
        break;
    }
  };

  const onObject = (o: ObjectTap) => {
    if (o.kind === 'lock') { openParcelPlacement(controller, scene, o.parcel); return; }
    if (o.kind === 'building') { openBuildingPanel(controller, scene, o.id); return; }
    const a = controller.state.animals.find((v) => v.id === o.id);
    if (!a) return;
    // Deliberate departure from the brief (accepted by the controller, spec 3.3/4.3 "zbiera się stuknięciem"):
    // with Ręka/Zbierz a ready product is collected straight away; otherwise the animal panel opens
    if (a.productReady && (scene.currentTool === 'hand' || scene.currentTool === 'harvest')) {
      report(controller.act(collectProduct, a.id));
      return;
    }
    openAnimalPanel(controller, scene, a.id);
  };

  scene.events.on(EV_TILE_TAP, (x: number, y: number) => onTile(x, y, false));
  scene.events.on(EV_DRAG_START, () => { collected = new Set(); });
  scene.events.on(EV_TILE_DRAG, (x: number, y: number) => onTile(x, y, true));
  scene.events.on(EV_OBJECT_TAP, onObject);
  const view = live((fn) => controller.subscribe(fn), key, bar, render);
}

/** Which crops are plantable right now (changes with level and season). */
function canPlantKey(controller: GameController): string {
  return (Object.keys(CROPS) as CropId[]).map((c) => {
    const r = canPlantNow(controller.state, c);
    return r.ok ? 1 : r.reason;
  }).join(',');
}
