// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({ default: { Math: { Clamp: (v: number, a: number, b: number) => Math.max(a, Math.min(b, v)) } } }));

import { createInitialState } from '../../src/core/state';
import type { GameState } from '../../src/core/types';
import { isoToScreen } from '../../src/game/iso';
import { FarmView } from '../../src/game/render/farmView';

/** Minimal stand-in for the Phaser game objects FarmView uses (chainable setters, position, texture). */
class FakeObj {
  visible = true; destroyed = false; depth = 0; scale = 1; width = 16; height = 16; text = '';
  texture: { key: string };
  constructor(public x: number, public y: number, key: string) { this.texture = { key }; }
  get displayWidth() { return this.width * this.scale; }
  setOrigin() { return this; }
  setDepth(d: number) { this.depth = d; return this; }
  setTint() { return this; }
  setAlpha() { return this; }
  setResolution() { return this; }
  setFlipX() { return this; }
  setVisible(v: boolean) { this.visible = v; return this; }
  setTexture(k: string) { this.texture.key = k; return this; }
  setPosition(x: number, y: number) { this.x = x; this.y = y; return this; }
  setX(x: number) { this.x = x; return this; }
  setScale(s: number) { this.scale = s; return this; }
  setText(t: string) { this.text = t; this.width = 6 * t.length; return this; }
  destroy() { this.destroyed = true; }
}

function fakeScene() {
  const objs: FakeObj[] = [];
  const make = (x: number, y: number, key: string) => { const o = new FakeObj(x, y, key); objs.push(o); return o; };
  const scene = {
    add: { image: make, text: (x: number, y: number, t: string) => make(x, y, '__text').setText(t) },
    textures: { getPixelAlpha: () => 255 },
  };
  const live = (key: string) => objs.filter((o) => !o.destroyed && o.texture.key === key && o.depth > 0);
  return { scene: scene as never, objs, live };
}

function farmWith(b: { id: string; kind: 'coop' | 'barn'; x: number; y: number }): GameState {
  const s = createInitialState(1);
  s.parcels[6] = true;
  s.buildings.push({ ...b, upgraded: false, trough: 0 });
  return s;
}

describe('FarmView', () => {
  it('after a state swap (import / new game) a reused building id is drawn at its new place', () => {
    const { scene, live } = fakeScene();
    const view = new FarmView(scene);
    view.refresh(farmWith({ id: 'b9', kind: 'coop', x: 4, y: 4 }), 0);
    expect(live('bld-coop')).toHaveLength(1);

    view.refresh(farmWith({ id: 'b9', kind: 'barn', x: 8, y: 5 }), 1); // other farm, same id
    expect(live('bld-coop')).toHaveLength(0);
    const barn = live('bld-barn');
    expect(barn).toHaveLength(1);
    expect(barn[0].x).toBe(isoToScreen(8, 5).sx);
  });

  it('same generation: building views are kept (no rebuild every refresh)', () => {
    const { scene, live } = fakeScene();
    const view = new FarmView(scene);
    const s = farmWith({ id: 'b9', kind: 'coop', x: 4, y: 4 });
    view.refresh(s, 0);
    const first = live('bld-coop')[0];
    view.refresh(s, 0);
    expect(live('bld-coop')[0]).toBe(first);
  });

  it('shows the next parcel price only on adjacent locked parcels, and a lock tap picks that parcel', () => {
    const { scene, objs } = fakeScene();
    const view = new FarmView(scene);
    const s = createInitialState(1); // owns parcel 5
    s.level = 2; // PARCEL_LEVEL
    view.refresh(s, 0);
    const prices = objs.filter((o) => o.texture.key === '__text' && o.visible);
    expect(prices).toHaveLength(4); // parcels 1, 4, 6, 9
    expect(prices.every((p) => p.text === '100')).toBe(true);
    const lock = isoToScreen(4 * 2 + 2, 4 * 1 + 2); // parcel 6 centre
    expect(view.pick(lock.sx, lock.sy + 10)).toEqual({ kind: 'lock', parcel: 6 });
    const owned = isoToScreen(4 + 2, 4 + 2); // parcel 5 is owned: its lock is hidden
    expect(view.pick(owned.sx, owned.sy)).toBeNull();
  });

  it('below PARCEL_LEVEL: locks are shown, but no prices', () => {
    const { scene, objs, live } = fakeScene();
    const view = new FarmView(scene);
    const s = createInitialState(1); // level 1
    view.refresh(s, 0);
    expect(objs.filter((o) => o.texture.key === '__text' && o.visible)).toHaveLength(0);
    expect(objs.filter((o) => o.texture.key === 'icon-coin' && o.visible)).toHaveLength(0);
    expect(live('icon-lock').filter((o) => o.visible)).toHaveLength(15);
  });

  it('each animal of a building stands at its own spot; a removed one keeps its head point for one refresh', () => {
    const { scene, live } = fakeScene();
    const view = new FarmView(scene);
    const s = farmWith({ id: 'b9', kind: 'coop', x: 4, y: 4 });
    for (let i = 0; i < 6; i++) {
      s.animals.push({
        id: `a${10 + i}`, species: 'chicken', breed: null, buildingId: 'b9', youngMsLeft: 0, sick: false, cycleMs: 0,
        productReady: false, treat: false, bornOnFarm: false,
      });
    }
    view.refresh(s, 0);
    const chickens = live('chicken');
    expect(chickens).toHaveLength(6);
    const spots = new Set(chickens.map((c) => `${Math.round(c.x / 8)},${Math.round(c.y / 4)}`));
    expect(spots.size).toBeGreaterThanOrEqual(5); // spread out (a few px of wander jitter allowed)
    const head = view.animalHead('a12');
    expect(head).not.toBeNull();
    s.animals = s.animals.filter((a) => a.id !== 'a12');
    view.refresh(s, 0);
    expect(live('chicken')).toHaveLength(5);
    expect(view.animalHead('a12')).toEqual(head);
    view.refresh(s, 0);
    expect(view.animalHead('a12')).toBeNull();
  });
});
