import Phaser from 'phaser';
import type { WeatherKind } from '../../core/types';

const MAX_PARTICLES = 150;
const DEPTH_WEATHER = 2000;
const HEAT_MAX_ALPHA = 0.08;
const CLOUDS = 5; // cloud shadows (sprites), created once
const CLOUD_TEX = { w: 128, h: 64 };
/** Cloud shadow alpha and how many of the clouds show, per weather (sun/heat: none). */
const CLOUD_LOOK: Partial<Record<WeatherKind, { alpha: number; count: number }>> = {
  rain: { alpha: 0.4, count: CLOUDS },
  snow: { alpha: 0.2, count: 3 },
};
const CLOUD_SPEED = { min: 3, max: 7 }; // viewport px per second at zoom 1 (slow drift to the right)

interface Cloud { img: Phaser.GameObjects.Image; speed: number }

function makeTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): void {
  if (scene.textures.exists(key)) return;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  if (g) draw(g);
  scene.textures.addCanvas(key, canvas);
}

/** A soft dark blob: a few overlapping radial gradients (drawn once into a canvas texture). */
function drawCloud(g: CanvasRenderingContext2D): void {
  const { w, h } = CLOUD_TEX;
  const puffs: [number, number, number][] = [[0.3, 0.55, 0.3], [0.52, 0.42, 0.34], [0.72, 0.58, 0.26], [0.5, 0.65, 0.3]];
  for (const [px, py, r] of puffs) {
    const cx = px * w;
    const cy = py * h;
    const rad = r * w;
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
    grad.addColorStop(0, 'rgba(34, 32, 52, 0.55)');
    grad.addColorStop(0.6, 'rgba(34, 32, 52, 0.3)');
    grad.addColorStop(1, 'rgba(34, 32, 52, 0)');
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(cx, cy, rad, rad * 0.55, 0, 0, Math.PI * 2);
    g.fill();
  }
}

/**
 * Camera-fixed weather: rain streaks, snow flakes (Phaser particles, <= 150 alive), a pulsing warm
 * overlay for heat and slowly drifting cloud shadows on rain (fewer, fainter on snow). Everything is
 * created once; `set` only toggles emitters and visibility, `update` moves the clouds (no allocation). Objects with scrollFactor 0
 * are still scaled by camera zoom around the viewport centre, so `layout()` re-fits the emit area.
 */
export class WeatherFx {
  private kind: WeatherKind | null = null;
  private zone = new Phaser.Geom.Rectangle(0, 0, 1, 1);
  private rain: Phaser.GameObjects.Particles.ParticleEmitter;
  private snow: Phaser.GameObjects.Particles.ParticleEmitter;
  private heat: Phaser.GameObjects.Rectangle;
  private heatTween: Phaser.Tweens.Tween;
  private lastKey = '';
  private clouds: Cloud[] = [];
  private cloudCount = 0;

  constructor(private scene: Phaser.Scene) {
    makeTexture(scene, 'fx-rain', 3, 6, (g) => {
      g.fillStyle = '#9fc8ff';
      g.fillRect(2, 0, 1, 2); g.fillRect(1, 2, 1, 2); g.fillRect(0, 4, 1, 2);
    });
    makeTexture(scene, 'fx-snow', 2, 2, (g) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, 2, 2); });
    const zone = { type: 'random', source: this.zone } as Phaser.Types.GameObjects.Particles.ParticleEmitterRandomZoneConfig;
    this.rain = scene.add.particles(0, 0, 'fx-rain', {
      emitZone: zone, lifespan: 600, speedX: { min: -70, max: -50 }, speedY: { min: 300, max: 380 },
      alpha: { start: 0.9, end: 0.3 }, frequency: 8, quantity: 1, maxAliveParticles: MAX_PARTICLES, emitting: false,
    }).setScrollFactor(0).setDepth(DEPTH_WEATHER).setVisible(false);
    this.snow = scene.add.particles(0, 0, 'fx-snow', {
      emitZone: zone, lifespan: 4000, speedX: { min: -12, max: 12 }, speedY: { min: 15, max: 30 },
      alpha: { start: 1, end: 0.4 }, frequency: 35, quantity: 1, maxAliveParticles: MAX_PARTICLES, emitting: false,
    }).setScrollFactor(0).setDepth(DEPTH_WEATHER).setVisible(false);
    this.heat = scene.add.rectangle(0, 0, 1, 1, 0xffd080, 0).setScrollFactor(0).setDepth(DEPTH_WEATHER).setVisible(false);
    makeTexture(scene, 'fx-cloud', CLOUD_TEX.w, CLOUD_TEX.h, drawCloud);
    for (let i = 0; i < CLOUDS; i++) {
      const img = scene.add.image(0, 0, 'fx-cloud').setScrollFactor(0).setDepth(DEPTH_WEATHER - 1)
        .setScale(0.9 + Math.random() * 0.6).setVisible(false);
      this.clouds.push({ img, speed: CLOUD_SPEED.min + Math.random() * (CLOUD_SPEED.max - CLOUD_SPEED.min) });
    }
    this.heatTween = scene.tweens.add({
      targets: this.heat, alpha: { from: 0, to: HEAT_MAX_ALPHA }, duration: 1600, yoyo: true, repeat: -1,
      ease: 'Sine.easeInOut', paused: true,
    });
    this.layout();
  }

  set(kind: WeatherKind): void {
    if (kind === this.kind) return;
    this.kind = kind;
    this.setEmitter(this.rain, kind === 'rain');
    this.setEmitter(this.snow, kind === 'snow');
    this.heat.setVisible(kind === 'heat');
    if (kind === 'heat') this.heatTween.resume(); else this.heatTween.pause();
    const look = CLOUD_LOOK[kind];
    this.cloudCount = look?.count ?? 0;
    this.clouds.forEach((c, i) => c.img.setVisible(i < this.cloudCount).setAlpha(look?.alpha ?? 0));
  }

  /** Drifts the visible clouds to the right; one that left the view comes back on the left at a new height. */
  update(deltaMs: number): void {
    if (this.cloudCount === 0) return;
    const dt = Math.min(deltaMs, 100) / 1000;
    const z = this.zone;
    for (let i = 0; i < this.cloudCount; i++) {
      const img = this.clouds[i].img;
      img.x += this.clouds[i].speed * dt;
      const half = img.displayWidth / 2;
      if (img.x - half > z.right) img.setPosition(z.x - half, z.y + Math.random() * z.height);
    }
  }

  /**
   * Spreads the clouds over the view at the start; after a viewport change (zoom, pinch, resize) keeps each
   * cloud at the same relative place, so they do not jump around while pinching.
   */
  private fitClouds(ox: number, oy: number, ow: number, oh: number, first: boolean): void {
    const z = this.zone;
    for (const c of this.clouds) {
      const fx = first ? Math.random() : (c.img.x - ox) / ow;
      const fy = first ? Math.random() : (c.img.y - oy) / oh;
      c.img.setPosition(z.x + fx * z.width, z.y + fy * z.height);
    }
  }

  private setEmitter(e: Phaser.GameObjects.Particles.ParticleEmitter, on: boolean): void {
    e.setVisible(on);
    if (on) e.start(); else { e.stop(); e.killAll(); }
  }

  /** Re-fit emit area / overlay to the viewport when the camera zoom or size changed (cheap, per frame). */
  layout(): void {
    const cam = this.scene.cameras.main;
    const k = `${cam.width}x${cam.height}@${cam.zoom}`;
    if (k === this.lastKey) return;
    const first = this.lastKey === '';
    this.lastKey = k;
    const { x: ox, y: oy, width: ow, height: oh } = this.zone;
    const w = cam.width / cam.zoom;
    const h = cam.height / cam.zoom;
    this.zone.setTo(cam.width / 2 - w / 2, cam.height / 2 - h / 2, w, h);
    this.heat.setPosition(cam.width / 2, cam.height / 2).setSize(w + 8, h + 8);
    this.fitClouds(ox, oy, ow, oh, first);
  }
}
