import Phaser from 'phaser';
import { GameController } from './game/controller';
import { FarmScene } from './game/FarmScene';
import { setUiRoot } from './ui/dom';
import { mountHud } from './ui/hud';
import { mountLevelUp } from './ui/levelup';
import { mountParentMenu } from './ui/parentMenu';
import { mountNotifications } from './ui/toast';
import { mountToolbar } from './ui/toolbar';
import './ui/ui.css';

function parseParams(search: string): { speed: number; seed: number; debug: boolean } {
  const q = new URLSearchParams(search);
  const rawSpeed = Number(q.get('speed'));
  const speed = Number.isFinite(rawSpeed) && q.has('speed') ? Math.min(100, Math.max(1, rawSpeed)) : 1;
  const rawSeed = Number(q.get('seed'));
  // the controller rng is deterministic per seed, so pick a random one unless given
  const seed = q.has('seed') && Number.isInteger(rawSeed) ? rawSeed | 0 : (Math.random() * 2 ** 32) | 0;
  return { speed, seed, debug: q.get('debug') === '1' };
}

const params = parseParams(window.location.search);
const controller = new GameController(window.localStorage, params);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  pixelArt: true,
  backgroundColor: '#cbdbfc',
  scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
  input: { mouse: { preventDefaultWheel: true } },
});
function mountUi(scene: FarmScene): void {
  const ui = document.getElementById('ui') as HTMLElement;
  setUiRoot(ui);
  const coinPill = mountHud(ui, controller);
  mountParentMenu(controller, coinPill, params.debug);
  mountToolbar(ui, controller, scene);
  mountNotifications(scene, controller);
  mountLevelUp(scene);
  if (params.debug) (window as unknown as { __farma: unknown }).__farma = { controller, scene, game };
}
game.scene.add('farm', FarmScene, true, { controller, onReady: mountUi });
