import Phaser from 'phaser';
import { GameController } from './game/controller';
import { FarmScene } from './game/FarmScene';

function parseParams(search: string): { speed: number; seed: number; debug: boolean } {
  const q = new URLSearchParams(search);
  const rawSpeed = Number(q.get('speed'));
  const speed = Number.isFinite(rawSpeed) && q.has('speed') ? Math.min(100, Math.max(1, rawSpeed)) : 1;
  const rawSeed = Number(q.get('seed'));
  // the controller rng is deterministic per seed, so pick a random one unless given
  const seed = q.has('seed') && Number.isInteger(rawSeed) ? rawSeed | 0 : (Math.random() * 2 ** 32) | 0;
  return { speed, seed, debug: q.get('debug') === '1' };
}

const controller = new GameController(window.localStorage, parseParams(window.location.search));

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  pixelArt: true,
  backgroundColor: '#cbdbfc',
  scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
  input: { mouse: { preventDefaultWheel: true } },
});
game.scene.add('farm', FarmScene, true, { controller });
