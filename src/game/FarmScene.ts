import Phaser from 'phaser';
import { preloadArt, registerAll } from '../art/registry';
import { MAP_SIZE, START_PARCEL, PARCEL_SIZE } from '../core/config';
import { tileOccupant } from '../core/map';
import type { GameEvent } from '../core/types';
import type { GameController } from './controller';
import { isoToScreen, nearestZoomIndex, screenToIso, TILE_H, TILE_W, ZOOM_STEPS } from './iso';
import { DEPTH, FarmView, type ObjectTap } from './render/farmView';

export type Tool = 'hand' | 'plant' | 'water' | 'harvest' | 'tractor';
export type { ObjectTap };

/**
 * Placement mode (fields, buildings, parcels): a ghost footprint follows the pointer, green when
 * `valid(x, y)`, red otherwise; a tap calls `onPlace(x, y)` with the footprint's top tile. With `snap`
 * the footprint snaps to a grid of that size (parcels). Normal tool/object events are suppressed.
 */
export interface Placement {
  w: number;
  h: number;
  snap?: number;
  /** optional sprite drawn semi-transparent over the footprint (2x2 buildings) */
  texture?: string;
  valid(x: number, y: number): boolean;
  onPlace(x: number, y: number): void;
  /** optional areas highlighted up front (e.g. every buyable parcel); re-read on each state refresh */
  zones?(): PlacementZone[];
}

/** 'ok' = can be placed/bought now; 'expensive' = allowed but not affordable yet. */
export interface PlacementZone { x: number; y: number; w: number; h: number; kind: 'ok' | 'expensive' }
const ZONE_COLOR = { ok: 0x6abe30, expensive: 0xdf7126 };

export interface FloatPart { text: string; icon?: string }

/** scene.events: (x, y) on a single-pointer tap (< TAP_SLOP px of movement). */
export const EV_TILE_TAP = 'tileTap';
/** scene.events: (x, y) for each new tile entered while dragging with a non-hand tool. */
export const EV_TILE_DRAG = 'tileDrag';
/** scene.events: (ObjectTap) when a tap lands on an animal sprite, a building sprite or a building footprint.
 * Such taps do not emit EV_TILE_TAP. */
export const EV_OBJECT_TAP = 'objectTap';
/** scene.events: (GameEvent) for each core event; the scene drains controller events on every refresh. */
export const EV_GAME_EVENT = 'gameEvent';

const TAP_SLOP = 8;
const START_ZOOM = 3;
const MARGIN = 64; // world px around the map the camera may show
const PINCH_MIN = ZOOM_STEPS[0] * 0.75;
const PINCH_MAX = ZOOM_STEPS[ZOOM_STEPS.length - 1] * 1.25;

type Gesture = 'none' | 'pending' | 'pan' | 'drag' | 'pinch' | 'ended';
interface Pt { x: number; y: number }

export class FarmScene extends Phaser.Scene {
  currentTool: Tool = 'hand';
  private controller!: GameController;
  private view!: FarmView;
  private highlight!: Phaser.GameObjects.Graphics;
  private ghost!: Phaser.GameObjects.Graphics;
  private zones!: Phaser.GameObjects.Graphics;
  private ghostImg!: Phaser.GameObjects.Image;
  private placement: Placement | null = null;
  private ghostTile: { x: number; y: number } | null = null;
  private unsubscribe: (() => void) | null = null;

  private pointers = new Map<number, Pt>();
  private gesture: Gesture = 'none';
  private start: Pt = { x: 0, y: 0 };
  private startScroll: Pt = { x: 0, y: 0 };
  private lastDragTile = -1;
  private pinch = { dist: 1, zoom: START_ZOOM, anchor: { x: 0, y: 0 } as Pt, mid: { x: 0, y: 0 } as Pt };

  constructor() {
    super('farm');
  }

  private onReady: ((scene: FarmScene) => void) | undefined;

  /** `onReady` runs at the end of create(), once scene events and the camera exist (UI mounts there). */
  init(data: { controller: GameController; onReady?: (scene: FarmScene) => void }): void {
    this.controller = data.controller;
    this.onReady = data.onReady;
  }

  preload(): void {
    preloadArt(this);
  }

  create(): void {
    registerAll(this);
    this.view = new FarmView(this);
    this.highlight = this.add.graphics().setDepth(DEPTH.highlight);
    this.zones = this.add.graphics().setDepth(DEPTH.highlight);
    this.ghost = this.add.graphics().setDepth(DEPTH.highlight + 1);
    this.ghostImg = this.add.image(0, 0, 'bld-coop').setOrigin(0.5, 1).setAlpha(0.6).setDepth(DEPTH.highlight + 2)
      .setVisible(false);
    this.setupCamera();
    this.setupInput();
    this.refresh();
    this.unsubscribe = this.controller.subscribe(() => this.refresh());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubscribe?.());
    this.onReady?.(this);
  }

  update(_time: number, delta: number): void {
    this.controller.step(delta);
    this.view.update(delta);
  }

  private refresh(): void {
    this.view.refresh(this.controller.state);
    if (this.placement) { this.drawZones(); this.drawGhost(this.ghostTile); }
    for (const e of this.controller.drainEvents()) this.events.emit(EV_GAME_EVENT, e as GameEvent);
  }

  // ---------------------------------------------------------------------------------------------
  // Placement mode and floating text (used by the DOM UI)
  // ---------------------------------------------------------------------------------------------

  setPlacement(p: Placement | null): void {
    this.placement = p;
    this.ghostTile = null;
    this.ghost.clear();
    this.ghostImg.setVisible(false);
    if (p) this.highlight.clear();
    this.drawZones();
  }

  private drawZones(): void {
    this.zones.clear();
    for (const z of this.placement?.zones?.() ?? []) {
      const c = ZONE_COLOR[z.kind];
      const top = isoToScreen(z.x, z.y);
      const right = isoToScreen(z.x + z.w, z.y);
      const bottom = isoToScreen(z.x + z.w, z.y + z.h);
      const left = isoToScreen(z.x, z.y + z.h);
      const pts = [top, right, bottom, left].map((p) => ({ x: p.sx, y: p.sy }));
      this.zones.fillStyle(c, 0.25);
      this.zones.fillPoints(pts, true);
      this.zones.lineStyle(2, c, 0.9);
      this.zones.strokePoints(pts, true);
    }
  }

  get placing(): boolean {
    return this.placement !== null;
  }

  private anchorFor(t: { x: number; y: number }, p: Placement): { x: number; y: number } {
    if (p.snap) return { x: Math.floor(t.x / p.snap) * p.snap, y: Math.floor(t.y / p.snap) * p.snap };
    return { x: Math.min(t.x, MAP_SIZE - p.w), y: Math.min(t.y, MAP_SIZE - p.h) };
  }

  private drawGhost(t: { x: number; y: number } | null): void {
    this.ghostTile = t;
    this.ghost.clear();
    this.ghostImg.setVisible(false);
    const p = this.placement;
    if (!p || !t) return;
    const a = this.anchorFor(t, p);
    const ok = p.valid(a.x, a.y);
    const color = ok ? 0x6abe30 : 0xac3232;
    this.ghost.fillStyle(color, 0.45);
    this.ghost.lineStyle(1, color, 1);
    for (let dy = 0; dy < p.h; dy++) {
      for (let dx = 0; dx < p.w; dx++) {
        const pts = diamondPts(a.x + dx, a.y + dy);
        this.ghost.fillPoints(pts, true);
        this.ghost.strokePoints(pts, true);
      }
    }
    if (p.texture) {
      const { sx, sy } = isoToScreen(a.x, a.y);
      this.ghostImg.setTexture(p.texture).setPosition(sx, sy + 32).setVisible(true)
        .setTint(ok ? 0xffffff : 0xff8080);
    }
  }

  /** Floating "+3" / "+2 XP" lines rising from tile (x, y). */
  floatText(x: number, y: number, parts: FloatPart[]): void {
    const { sx, sy } = isoToScreen(x, y);
    parts.forEach((part, i) => {
      const c = this.add.container(sx, sy - 4 - i * 10).setDepth(DEPTH.icon + 10);
      const txt = this.add.text(0, 0, part.text, {
        fontFamily: 'system-ui, sans-serif', fontStyle: 'bold', fontSize: '9px', color: '#fbf236',
        stroke: '#222034', strokeThickness: 2,
      }).setOrigin(0, 0.5).setResolution(4);
      c.add(txt);
      if (part.icon) {
        const img = this.add.image(-1, 0, part.icon).setOrigin(1, 0.5);
        img.setScale(Math.min(1, 10 / img.height));
        c.add(img);
      }
      c.x -= txt.width / 2 - (part.icon ? 5 : 0);
      this.tweens.add({
        targets: c, y: c.y - 18, alpha: { from: 1, to: 0 }, delay: i * 150, duration: 1400, ease: 'Cubic.easeOut',
        onComplete: () => c.destroy(),
      });
    });
  }

  // ---------------------------------------------------------------------------------------------
  // Camera
  // ---------------------------------------------------------------------------------------------

  private setupCamera(): void {
    const cam = this.cameras.main;
    const half = (MAP_SIZE * TILE_W) / 2;
    // buildings on the top row reach ~32px above the map's top corner
    cam.setBounds(-half - MARGIN, -32 - MARGIN, 2 * (half + MARGIN), MAP_SIZE * TILE_H + 32 + 2 * MARGIN);
    cam.setZoom(START_ZOOM);
    const p = START_PARCEL;
    const parcels = MAP_SIZE / PARCEL_SIZE;
    const c = isoToScreen((p % parcels) * PARCEL_SIZE + PARCEL_SIZE / 2, Math.floor(p / parcels) * PARCEL_SIZE + PARCEL_SIZE / 2);
    cam.centerOn(c.sx, c.sy);
  }

  /** Screen → world without relying on the camera matrix (stale until the next render). */
  private toWorld(p: Pt): Pt {
    const cam = this.cameras.main;
    return {
      x: cam.scrollX + cam.width / 2 + (p.x - cam.width / 2) / cam.zoom,
      y: cam.scrollY + cam.height / 2 + (p.y - cam.height / 2) / cam.zoom,
    };
  }

  /** Set zoom while keeping world point `world` under screen point `screen`. */
  private zoomAt(zoom: number, world: Pt, screen: Pt): void {
    const cam = this.cameras.main;
    cam.setZoom(zoom);
    cam.setScroll(
      world.x - cam.width / 2 - (screen.x - cam.width / 2) / zoom,
      world.y - cam.height / 2 - (screen.y - cam.height / 2) / zoom,
    );
  }

  // ---------------------------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------------------------

  private setupInput(): void {
    this.input.addPointer(1); // two touch pointers for pinch
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => this.onDown(p));
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => this.onMove(p));
    this.input.on(Phaser.Input.Events.POINTER_UP, (p: Phaser.Input.Pointer) => this.onUp(p));
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, (p: Phaser.Input.Pointer) => this.onUp(p));
    this.input.on(Phaser.Input.Events.GAME_OUT, () => {
      if (this.pointers.size === 0) { this.highlight.clear(); if (this.placement) this.drawGhost(null); }
    });
    // A lost touchend/pointerup must not leave a stale pointer (which would keep the next touch in pinch mode).
    const canvas = this.game.canvas;
    const onCancel = () => this.resetPointers();
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) setTimeout(() => { if (this.pointers.size > 0) this.resetPointers(); }, 0);
    };
    canvas.addEventListener('touchcancel', onCancel);
    canvas.addEventListener('touchend', onTouchEnd);
    window.addEventListener('blur', onCancel);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      canvas.removeEventListener('touchcancel', onCancel);
      canvas.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('blur', onCancel);
    });
    this.input.on(Phaser.Input.Events.POINTER_WHEEL,
      (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => this.onWheel(p, dy));
  }

  private tileAt(p: Pt): { x: number; y: number } | null {
    const w = this.toWorld(p);
    const t = screenToIso(w.x, w.y);
    return t.x >= 0 && t.y >= 0 && t.x < MAP_SIZE && t.y < MAP_SIZE ? t : null;
  }

  private showHighlight(t: { x: number; y: number } | null): void {
    if (this.placement) { this.drawGhost(t); return; }
    this.highlight.clear();
    if (!t) return;
    const pts = diamondPts(t.x, t.y);
    this.highlight.lineStyle(1, 0xffffff, 0.8);
    this.highlight.strokePoints(pts, true);
    this.highlight.fillStyle(0xffffff, 0.15);
    this.highlight.fillPoints(pts, true);
  }

  private resetPointers(): void {
    if (this.gesture === 'pinch') this.snapZoom();
    this.pointers.clear();
    this.gesture = 'none';
    this.highlight.clear();
  }

  private onDown(p: Phaser.Input.Pointer): void {
    this.pointers.set(p.id, { x: p.x, y: p.y });
    if (this.pointers.size === 1 && this.gesture === 'none') {
      this.gesture = 'pending';
      this.start = { x: p.x, y: p.y };
      this.startScroll = { x: this.cameras.main.scrollX, y: this.cameras.main.scrollY };
      this.showHighlight(this.tileAt(p));
    } else if (this.pointers.size >= 2) {
      this.beginPinch();
    }
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (!this.pointers.has(p.id)) {
      if (this.pointers.size === 0 && !p.wasTouch) this.showHighlight(this.tileAt(p)); // mouse hover
      return;
    }
    this.pointers.set(p.id, { x: p.x, y: p.y });
    if (this.gesture === 'pinch') { this.updatePinch(); return; }
    if (this.gesture === 'pending' && Math.hypot(p.x - this.start.x, p.y - this.start.y) >= TAP_SLOP) {
      this.gesture = this.currentTool === 'hand' || this.placement ? 'pan' : 'drag';
      this.lastDragTile = -1;
      if (this.gesture === 'drag') this.dragOver(this.start);
    }
    if (this.gesture === 'pan') {
      const cam = this.cameras.main;
      cam.setScroll(
        this.startScroll.x - (p.x - this.start.x) / cam.zoom,
        this.startScroll.y - (p.y - this.start.y) / cam.zoom,
      );
      this.highlight.clear();
      if (this.placement && !p.wasTouch) this.drawGhost(this.tileAt(p));
    } else if (this.gesture === 'drag') {
      this.dragOver(p);
    }
  }

  private dragOver(p: Pt): void {
    const t = this.tileAt(p);
    this.showHighlight(t);
    if (!t) return;
    const idx = t.y * MAP_SIZE + t.x;
    if (idx === this.lastDragTile) return;
    this.lastDragTile = idx;
    this.events.emit(EV_TILE_DRAG, t.x, t.y);
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (!this.pointers.has(p.id)) return;
    this.pointers.delete(p.id);
    if (this.gesture === 'pinch') {
      if (this.pointers.size < 2) {
        this.snapZoom();
        this.gesture = 'ended'; // remaining finger does nothing until all are lifted
      }
    } else if (this.gesture === 'pending' && this.pointers.size === 0) {
      this.tap(p);
    }
    if (this.pointers.size === 0) {
      this.gesture = 'none';
      if (p.wasTouch) this.highlight.clear();
    }
  }

  private tap(p: Pt): void {
    const t = this.tileAt(p);
    if (this.placement) {
      if (!t) return;
      const pl = this.placement;
      const a = this.anchorFor(t, pl);
      this.drawGhost(t); // touch has no hover: show where the tap landed
      pl.onPlace(a.x, a.y);
      return;
    }
    const w = this.toWorld(p);
    let obj = this.view.pick(w.x, w.y);
    if (!obj && t) {
      const occ = tileOccupant(this.controller.state, t.x, t.y);
      if (occ?.kind === 'building') obj = { kind: 'building', id: occ.building.id };
    }
    if (obj) { this.events.emit(EV_OBJECT_TAP, obj); return; }
    if (t) this.events.emit(EV_TILE_TAP, t.x, t.y);
  }

  private twoPointers(): [Pt, Pt] {
    const [a, b] = [...this.pointers.values()];
    return [a, b];
  }

  private beginPinch(): void {
    const [a, b] = this.twoPointers();
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    this.gesture = 'pinch';
    this.highlight.clear();
    this.pinch = {
      dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      zoom: this.cameras.main.zoom,
      anchor: this.toWorld(mid),
      mid,
    };
  }

  private updatePinch(): void {
    const [a, b] = this.twoPointers();
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const zoom = Phaser.Math.Clamp(this.pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y) / this.pinch.dist, PINCH_MIN, PINCH_MAX);
    this.pinch.mid = mid;
    this.zoomAt(zoom, this.pinch.anchor, mid); // pan + pinch around the moving midpoint
  }

  private snapZoom(): void {
    const mid = this.pinch.mid;
    const zoom = ZOOM_STEPS[nearestZoomIndex(this.cameras.main.zoom)];
    this.zoomAt(zoom, this.toWorld(mid), mid);
  }

  private onWheel(p: Phaser.Input.Pointer, dy: number): void {
    if (dy === 0) return;
    const i = nearestZoomIndex(this.cameras.main.zoom) + (dy > 0 ? -1 : 1);
    const zoom = ZOOM_STEPS[Phaser.Math.Clamp(i, 0, ZOOM_STEPS.length - 1)];
    if (zoom === this.cameras.main.zoom) return;
    const screen = { x: p.x, y: p.y };
    this.zoomAt(zoom, this.toWorld(screen), screen);
  }
}

function diamondPts(x: number, y: number): Pt[] {
  const { sx, sy } = isoToScreen(x, y);
  return [
    { x: sx, y: sy }, { x: sx + TILE_W / 2, y: sy + TILE_H / 2 },
    { x: sx, y: sy + TILE_H }, { x: sx - TILE_W / 2, y: sy + TILE_H / 2 },
  ];
}
