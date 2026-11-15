import Phaser from 'phaser';
import type { WeatherKind } from '../../core/types';

const MAX_PARTICLES = 150;
const DEPTH_WEATHER = 2000;
const HEAT_MAX_ALPHA = 0.08;

function makeTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): void {
  if (scene.textures.exists(key)) return;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  if (g) draw(g);
  scene.textures.addCanvas(key, canvas);
}

/**
 * Camera-fixed weather: rain streaks, snow flakes (Phaser particles, <= 150 alive) and a pulsing warm
 * overlay for heat. Everything is created once; `set` only toggles emitters. Objects with scrollFactor 0
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
    this.lastKey = k;
    const w = cam.width / cam.zoom;
    const h = cam.height / cam.zoom;
    this.zone.setTo(cam.width / 2 - w / 2, cam.height / 2 - h / 2, w, h);
    this.heat.setPosition(cam.width / 2, cam.height / 2).setSize(w + 8, h + 8);
  }
}
