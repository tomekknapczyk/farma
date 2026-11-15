import Phaser from 'phaser';
import { textureFor } from '../../art/registry';
import { troughCap } from '../../core/animals';
import { MAP_SIZE, PARCEL_SIZE } from '../../core/config';
import { cropStage, isReady } from '../../core/crops';
import { isTileUnlocked, parcelOf } from '../../core/map';
import { getSeasonInfo } from '../../core/seasons';
import type { Animal, Building, GameState, Season } from '../../core/types';
import { isoToScreen } from '../iso';
import { blendTint, currentTint, mulTint, snowAmount } from '../seasonFx';
import { animalTexture, statusIcon } from './animalArt';

/** Ground is flat (depth 0); objects sort by (x + y); highlight and icons float above. */
export const DEPTH = { ground: 0, object: 10, highlight: 800, icon: 1000 };
export const objectDepth = (x: number, y: number): number => DEPTH.object + (x + y) * 4;

/** A tap on a building (sprite incl. roof, or footprint) or directly on an animal sprite. */
export type ObjectTap = { kind: 'building'; id: string } | { kind: 'animal'; id: string };

const PARCELS = MAP_SIZE / PARCEL_SIZE;
const ANIMAL_PICK_SLOP = 3; // world px around an animal sprite that still counts as a hit
const ANIMAL_SPEED = 10; // world px per second
/**
 * Trees stand only on locked land and are dimmed a little so the owned land stays the focus.
 * The dimming fades out with the snow, so winter trees read as snowy white, not grey; locked
 * land itself stays distinct through its own darker tile (`tile-locked`, `@winter`).
 */
const TREE_TINT = 0xb0b0b0;
const SNOW_TILE = 'tile-grass@winter'; // white diamond reused as the snow/frost overlay
const SNOW_ON_GROUND = 0.8;
const SNOW_ON_LOCKED = 0.45; // lighter, so locked land stays darker than owned land in winter
const FROST_ON_FIELD = 0.4;
const DEPTH_SNOW = 1;

interface AnimalView {
  sprite: Phaser.GameObjects.Image;
  icon: Phaser.GameObjects.Image;
  buildingId: string;
  tx: number; ty: number; // wander target (world px)
  wait: number; // ms left standing still
}

function tileHash(x: number, y: number): number {
  return ((x * 73856093) ^ (y * 19349663)) >>> 0;
}

export class FarmView {
  private tiles: Phaser.GameObjects.Image[] = [];
  private snowTiles: Phaser.GameObjects.Image[] = [];
  private tint = 0xffffff;
  private snow = 0;
  private locks: Phaser.GameObjects.Image[] = [];
  private trees: { img: Phaser.GameObjects.Image; x: number; y: number }[] = [];
  private crops = new Map<string, Phaser.GameObjects.Image>();
  private waterIcons = new Map<string, Phaser.GameObjects.Image>();
  private buildings = new Map<string, { bld: Phaser.GameObjects.Image; trough: Phaser.GameObjects.Image; roof: Phaser.GameObjects.Image }>();
  private animals = new Map<string, AnimalView>();
  private buildingById = new Map<string, Building>();

  constructor(private scene: Phaser.Scene) {
    for (let y = 0; y < MAP_SIZE; y++) {
      for (let x = 0; x < MAP_SIZE; x++) {
        const { sx, sy } = isoToScreen(x, y);
        this.tiles.push(scene.add.image(sx, sy, 'tile-grass').setOrigin(0.5, 0).setDepth(DEPTH.ground));
        this.snowTiles.push(scene.add.image(sx, sy, SNOW_TILE).setOrigin(0.5, 0).setDepth(DEPTH_SNOW).setAlpha(0).setVisible(false));
        // scenery: a few trees on tiles that start locked, away from the parcel centre lock icon
        const lx = x % PARCEL_SIZE;
        const ly = y % PARCEL_SIZE;
        const nearCentre = (lx === 1 || lx === 2) && (ly === 1 || ly === 2);
        if (!nearCentre && tileHash(x, y) % 7 === 0) {
          const img = scene.add.image(sx, sy + 12, 'tree').setOrigin(0.5, 1).setDepth(objectDepth(x, y));
          this.trees.push({ img, x, y });
        }
      }
    }
    for (let p = 0; p < PARCELS * PARCELS; p++) {
      const cx = (p % PARCELS) * PARCEL_SIZE + PARCEL_SIZE / 2;
      const cy = Math.floor(p / PARCELS) * PARCEL_SIZE + PARCEL_SIZE / 2;
      const { sx, sy } = isoToScreen(cx, cy);
      this.locks.push(scene.add.image(sx, sy, 'icon-lock').setDepth(DEPTH.icon));
    }
  }

  refresh(s: GameState): void {
    const season = getSeasonInfo(s.timeMs).season;
    const tint = currentTint(s.timeMs);
    const snow = snowAmount(s.timeMs);
    const tintChanged = tint !== this.tint;
    const snowChanged = Math.abs(snow - this.snow) > 0.002;
    this.tint = tint;
    this.snow = snow;
    this.refreshGround(s, season);
    this.refreshFields(s, season);
    this.refreshBuildings(s, season);
    this.refreshAnimals(s, season);
    if (tintChanged) this.applyTintToAll();
    if (snowChanged || this.snow > 0) this.applySnow(s);
  }

  /** Season tint on world objects (tiles, trees, crops, buildings, animals); not on UI icons or overlays. */
  private applyTintToAll(): void {
    for (const img of this.tiles) img.setTint(this.tint);
    for (const t of this.trees) t.img.setTint(this.treeTint());
    for (const img of this.crops.values()) img.setTint(this.tint);
    for (const v of this.buildings.values()) { v.bld.setTint(this.tint); v.trough.setTint(this.tint); v.roof.setTint(this.tint); }
    for (const v of this.animals.values()) v.sprite.setTint(this.tint);
  }

  /** Snow on the ground (frost on fields) and snow caps on roofs, alpha = current snow amount. */
  private applySnow(s: GameState): void {
    const fieldAt = new Set(s.fields.map((f) => f.y * MAP_SIZE + f.x));
    this.snowTiles.forEach((img, i) => {
      const unlocked = isTileUnlocked(s, i % MAP_SIZE, Math.floor(i / MAP_SIZE));
      const a = this.snow * (fieldAt.has(i) ? FROST_ON_FIELD : unlocked ? SNOW_ON_GROUND : SNOW_ON_LOCKED);
      img.setAlpha(a).setVisible(a > 0);
    });
    for (const v of this.buildings.values()) v.roof.setAlpha(this.snow).setVisible(this.snow > 0);
    for (const t of this.trees) t.img.setTint(this.treeTint());
  }

  private treeTint(): number {
    return mulTint(blendTint(TREE_TINT, 0xffffff, this.snow), this.tint);
  }

  /** Per-frame animation (animal wandering). */
  update(deltaMs: number): void {
    const dt = Math.min(deltaMs, 100) / 1000;
    for (const v of this.animals.values()) {
      const b = this.buildingById.get(v.buildingId);
      if (!b) continue;
      if (v.wait > 0) {
        v.wait -= deltaMs;
      } else {
        const dx = v.tx - v.sprite.x;
        const dy = v.ty - v.sprite.y;
        const dist = Math.hypot(dx, dy);
        const stepLen = ANIMAL_SPEED * dt;
        if (dist <= stepLen) {
          v.sprite.setPosition(v.tx, v.ty);
          v.wait = 1000 + Math.random() * 3000;
          [v.tx, v.ty] = wanderPoint(b);
        } else {
          v.sprite.x += (dx / dist) * stepLen;
          v.sprite.y += (dy / dist) * stepLen;
          v.sprite.setFlipX(dx > 0); // sprites face left
        }
      }
      v.sprite.setDepth(animalDepth(b, v.sprite.y));
      v.icon.setPosition(v.sprite.x, v.sprite.y - v.sprite.height); // above the head (horses are taller)
    }
  }

  /** Topmost animal (bounds + slop) or building (opaque sprite pixel) at a world point. */
  pick(wx: number, wy: number): ObjectTap | null {
    let best: { tap: ObjectTap; depth: number } | null = null;
    for (const [id, v] of this.animals) {
      const img = v.sprite;
      const left = img.x - img.width / 2 - ANIMAL_PICK_SLOP;
      const top = img.y - img.height - ANIMAL_PICK_SLOP;
      const inside = wx >= left && wx < img.x + img.width / 2 + ANIMAL_PICK_SLOP && wy >= top && wy < img.y + ANIMAL_PICK_SLOP;
      if (inside && (!best || img.depth > best.depth)) best = { tap: { kind: 'animal', id }, depth: img.depth };
    }
    if (best) return best.tap;
    for (const [id, v] of this.buildings) {
      const img = v.bld;
      const px = Math.floor(wx - (img.x - img.width / 2));
      const py = Math.floor(wy - (img.y - img.height));
      if (px < 0 || py < 0 || px >= img.width || py >= img.height) continue;
      if (this.scene.textures.getPixelAlpha(px, py, img.texture.key) === 0) continue;
      if (!best || img.depth > best.depth) best = { tap: { kind: 'building', id }, depth: img.depth };
    }
    return best?.tap ?? null;
  }

  private refreshGround(s: GameState, season: Season): void {
    const fieldAt = new Map(s.fields.map((f) => [f.y * MAP_SIZE + f.x, f]));
    for (let y = 0; y < MAP_SIZE; y++) {
      for (let x = 0; x < MAP_SIZE; x++) {
        const i = y * MAP_SIZE + x;
        const f = fieldAt.get(i);
        let key: string;
        if (f) key = textureFor(f.watered ? 'field-wet' : 'field-dry', season);
        else if (isTileUnlocked(s, x, y)) key = textureFor('tile-grass', season);
        else key = textureFor('tile-locked', season);
        if (this.tiles[i].texture.key !== key) this.tiles[i].setTexture(key);
      }
    }
    this.locks.forEach((img, p) => img.setVisible(!s.parcels[p]));
    const treeKey = textureFor('tree', season);
    for (const t of this.trees) {
      const unlocked = s.parcels[parcelOf(t.x, t.y)];
      // trees only decorate locked land; they disappear when the parcel is bought
      t.img.setVisible(!unlocked);
      if (t.img.texture.key !== treeKey) t.img.setTexture(treeKey);
      t.img.setTint(this.treeTint());
    }
  }

  private refreshFields(s: GameState, season: Season): void {
    const seen = new Set<string>();
    for (const f of s.fields) {
      const { sx, sy } = isoToScreen(f.x, f.y);
      if (f.crop !== null) {
        seen.add(f.id);
        const key = textureFor(`crop-${f.crop}-${cropStage(f)}`, season);
        let img = this.crops.get(f.id);
        if (!img) {
          img = this.scene.add.image(sx, sy + 16, key).setOrigin(0.5, 1).setDepth(objectDepth(f.x, f.y)).setTint(this.tint);
          this.crops.set(f.id, img);
        } else if (img.texture.key !== key) img.setTexture(key);
      }
      const needsWater = f.crop !== null && !f.watered && !isReady(f);
      let drop = this.waterIcons.get(f.id);
      if (needsWater && !drop) {
        drop = this.scene.add.image(sx, sy + 2, 'icon-water').setOrigin(0.5, 1).setDepth(DEPTH.icon);
        this.waterIcons.set(f.id, drop);
      }
      drop?.setVisible(needsWater);
    }
    for (const [id, img] of this.crops) if (!seen.has(id)) { img.destroy(); this.crops.delete(id); }
    const fieldIds = new Set(s.fields.map((f) => f.id));
    for (const [id, img] of this.waterIcons) if (!fieldIds.has(id)) { img.destroy(); this.waterIcons.delete(id); }
  }

  private refreshBuildings(s: GameState, season: Season): void {
    this.buildingById = new Map(s.buildings.map((b) => [b.id, b]));
    for (const b of s.buildings) {
      const { sx, sy } = isoToScreen(b.x, b.y);
      const fill = b.trough / troughCap(b);
      const troughKey = textureFor(fill <= 0 ? 'trough-empty' : fill < 0.5 ? 'trough-low' : 'trough-full', season);
      let v = this.buildings.get(b.id);
      if (!v) {
        const depth = objectDepth(b.x + 1, b.y + 1);
        v = {
          bld: this.scene.add.image(sx, sy + 32, `bld-${b.kind}`).setOrigin(0.5, 1).setDepth(depth).setTint(this.tint),
          trough: this.scene.add.image(sx - 16, sy + 23, troughKey).setOrigin(0.5, 1).setDepth(depth + 1).setTint(this.tint),
          roof: this.scene.add.image(sx, sy + 32, textureFor(`bld-${b.kind}`, 'winter')).setOrigin(0.5, 1).setDepth(depth + 0.1)
            .setTint(this.tint).setAlpha(this.snow).setVisible(this.snow > 0),
        };
        this.buildings.set(b.id, v);
      }
      if (v.trough.texture.key !== troughKey) v.trough.setTexture(troughKey);
    }
    for (const [id, v] of this.buildings) {
      if (!this.buildingById.has(id)) { v.bld.destroy(); v.trough.destroy(); v.roof.destroy(); this.buildings.delete(id); }
    }
  }

  private refreshAnimals(s: GameState, season: Season): void {
    const seen = new Set<string>();
    for (const a of s.animals) {
      const b = this.buildingById.get(a.buildingId);
      if (!b) continue;
      seen.add(a.id);
      let v = this.animals.get(a.id);
      if (!v) {
        const [x, y] = wanderPoint(b);
        const [tx, ty] = wanderPoint(b);
        v = {
          sprite: this.scene.add.image(x, y, textureFor(animalTexture(a), season)).setOrigin(0.5, 1).setDepth(animalDepth(b, y)).setTint(this.tint),
          icon: this.scene.add.image(x, y - 20, 'icon-heart').setOrigin(0.5, 1).setDepth(DEPTH.icon).setVisible(false),
          buildingId: b.id, tx, ty, wait: Math.random() * 2000,
        };
        this.animals.set(a.id, v);
      }
      const key = textureFor(animalTexture(a), season);
      if (v.sprite.texture.key !== key) v.sprite.setTexture(key);
      const icon = statusIcon(a);
      v.icon.setVisible(icon !== null);
      if (icon && v.icon.texture.key !== icon) v.icon.setTexture(icon);
    }
    for (const [id, v] of this.animals) {
      if (!seen.has(id)) { v.sprite.destroy(); v.icon.destroy(); this.animals.delete(id); }
    }
  }
}

/** Random foot position on the front tiles of a building's 2x2 footprint (visual only). */
function wanderPoint(b: Building): [number, number] {
  const tiles: [number, number][] = [[b.x + 1, b.y], [b.x, b.y + 1], [b.x + 1, b.y + 1]];
  const [tx, ty] = tiles[Math.floor(Math.random() * tiles.length)];
  const { sx, sy } = isoToScreen(tx, ty);
  return [sx + (Math.random() * 12 - 6), sy + 10 + (Math.random() * 4 - 2)];
}

function animalDepth(b: Building, footY: number): number {
  const base = objectDepth(b.x + 1, b.y + 1) + 2;
  const top = isoToScreen(b.x, b.y).sy;
  return base + Phaser.Math.Clamp((footY - top) / 32, 0, 0.99);
}
