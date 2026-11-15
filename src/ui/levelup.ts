/** Level-up dialog: "Poziom N!", icons of what unlocked, "Super!". Queued; blocks input until dismissed. */
import { unlocksAt } from '../core/economy';
import type { GameEvent } from '../core/types';
import { EV_GAME_EVENT, type FarmScene } from '../game/FarmScene';
import { T } from './copy';
import { btn, el, getUiRoot } from './dom';
import { icon, unlockIcon } from './icons';

const queue: number[] = [];
let showing = false;

export function mountLevelUp(scene: FarmScene): void {
  scene.events.on(EV_GAME_EVENT, (e: GameEvent) => {
    if (e.type !== 'levelUp') return;
    queue.push(e.level);
    if (!showing) showNext();
  });
}

function showNext(): void {
  const level = queue.shift();
  if (level === undefined) { showing = false; return; }
  showing = true;
  const unlocks = el('div', 'unlocks', ...unlocksAt(level).map((k) => el('div', 'unlock', icon(unlockIcon(k), 'unlock-icon'), el('span', '', T.unlockName(k)))));
  const layer = el('div', 'levelup-layer');
  const box = el('div', 'levelup',
    icon('icon-star', 'levelup-star'),
    el('h1', '', T.levelUp(level)),
    unlocks,
    btn({ label: T.super, cls: 'super', onTap: () => { layer.remove(); showNext(); } }),
  );
  layer.append(box);
  getUiRoot().append(layer);
}
