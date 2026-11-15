import Phaser from 'phaser';
import { preloadArt, registerAll } from '../art/registry';
import { MAP_SIZE, START_PARCEL, PARCEL_SIZE } from '../core/config';
import { harvest, isReady, plant } from '../core/crops';
import { tileOccupant } from '../core/map';
import type { GameEvent } from '../core/types';
import type { GameController } from './controller';
import { isoToScreen, nearestZoomIndex, screenToIso, TILE_H, TILE_W, ZOOM_STEPS } from './iso';
import { DEPTH, FarmView } from './render/farmView';

export type Tool = 'hand' | 'plant' | 'water' | 'harvest' | 'tractor';
export type ObjectTap = { kind: 'building'; id: string } | { kind: 'animal'; id: string };

/** scene.events: (x, y) on a single-pointer tap (< TAP_SLOP px of movement). */
export const EV_TILE_TAP = 'tileTap';
/** scene.events: (x, y) for each new tile entered while dragging with a non-hand tool. */
export const EV_TILE_DRAG = 'tileDrag';
/** scene.events: (ObjectTap) when a tap lands on a building footprint (animals count as their building). */
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

  init(data: { controller: GameController }): void {
    this.controller = data.controller;
  }

  preload(): void {
    preloadArt(this);
  }

  create(): void {
    registerAll(this);
    this.view = new FarmView(this);
    this.highlight = this.add.graphics().setDepth(DEPTH.highlight);
    this.setupCamera();
    this.setupInput();
    this.refresh();
    this.unsubscribe = this.controller.subscribe(() => this.refresh());
    // TEMP(Task 12): dev-only tap behaviour until the toolbar exists.
    this.events.on(EV_TILE_TAP, (x: number, y: number) => this.tempTap(x, y));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubscribe?.());
  }

  update(_time: number, delta: number): void {
    this.controller.step(delta);
    this.view.update(delta);
  }

  private refresh(): void {
    this.view.refresh(this.controller.state);
    for (const e of this.controller.drainEvents()) this.events.emit(EV_GAME_EVENT, e as GameEvent);
  }

  // TEMP(Task 12): tap on an empty field plants wheat; on a ready field harvests.
  private tempTap(x: number, y: number): void {
    const occ = tileOccupant(this.controller.state, x, y);
    if (occ?.kind !== 'field') return;
    const f = occ.field;
    if (f.crop === null) this.controller.act(plant, f.id, 'wheat');
    else if (isReady(f)) this.controller.act(harvest, f.id);
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
    this.input.on(Phaser.Input.Events.GAME_OUT, () => { if (this.pointers.size === 0) this.highlight.clear(); });
    this.input.on(Phaser.Input.Events.POINTER_WHEEL,
      (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => this.onWheel(p, dy));
  }

  private tileAt(p: Pt): { x: number; y: number } | null {
    const w = this.toWorld(p);
    const t = screenToIso(w.x, w.y);
    return t.x >= 0 && t.y >= 0 && t.x < MAP_SIZE && t.y < MAP_SIZE ? t : null;
  }

  private showHighlight(t: { x: number; y: number } | null): void {
    this.highlight.clear();
    if (!t) return;
    const { sx, sy } = isoToScreen(t.x, t.y);
    this.highlight.lineStyle(1, 0xffffff, 0.8);
    this.highlight.strokePoints([
      { x: sx, y: sy }, { x: sx + TILE_W / 2, y: sy + TILE_H / 2 },
      { x: sx, y: sy + TILE_H }, { x: sx - TILE_W / 2, y: sy + TILE_H / 2 },
    ], true);
    this.highlight.fillStyle(0xffffff, 0.15);
    this.highlight.fillPoints([
      { x: sx, y: sy }, { x: sx + TILE_W / 2, y: sy + TILE_H / 2 },
      { x: sx, y: sy + TILE_H }, { x: sx - TILE_W / 2, y: sy + TILE_H / 2 },
    ], true);
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
      this.gesture = this.currentTool === 'hand' ? 'pan' : 'drag';
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
      this.tap(this.tileAt(p));
    }
    if (this.pointers.size === 0) {
      this.gesture = 'none';
      if (p.wasTouch) this.highlight.clear();
    }
  }

  private tap(t: { x: number; y: number } | null): void {
    if (!t) return;
    this.events.emit(EV_TILE_TAP, t.x, t.y);
    const occ = tileOccupant(this.controller.state, t.x, t.y);
    if (occ?.kind === 'building') {
      const tap: ObjectTap = { kind: 'building', id: occ.building.id };
      this.events.emit(EV_OBJECT_TAP, tap);
    }
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
