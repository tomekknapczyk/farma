/** Short toasts, rejected-action messages and game-event notifications (floating gains). */
import { canPlantNow } from '../core/crops';
import type { ActionResult, GameEvent } from '../core/types';
import type { GameController } from '../game/controller';
import { EV_GAME_EVENT, type FarmScene } from '../game/FarmScene';
import { T } from './copy';
import { el, getUiRoot } from './dom';
import { itemIcon } from './icons';

export type ToastKind = 'error' | 'info' | 'good';

const TOAST_MS = 2000;
const MAX_TOASTS = 3;
let stack: HTMLElement | null = null;

export function showToast(text: string, kind: ToastKind = 'info'): void {
  if (!stack || !stack.isConnected) {
    stack = el('div', 'toasts');
    getUiRoot().append(stack);
  }
  // the same message again (e.g. while dragging a tool) just restarts its timer
  const same = [...stack.children].find((c) => c.textContent === text) as HTMLElement | undefined;
  same?.remove();
  const t = el('div', `toast ${kind}`, text);
  stack.append(t);
  while (stack.children.length > MAX_TOASTS) stack.firstElementChild?.remove();
  setTimeout(() => t.remove(), TOAST_MS);
}

/** Shows the Polish reason for a rejected action. `lockLevel` = level the attempted thing needs. */
export function report(r: ActionResult, lockLevel = 0): boolean {
  if (!r.ok) showToast(T.reason(r.reason, lockLevel), 'error');
  return r.ok;
}

/** Listens to core events re-emitted by the scene. Level-ups are handled by levelup.ts. */
export function mountNotifications(scene: FarmScene, controller: GameController): void {
  scene.events.on(EV_GAME_EVENT, (e: GameEvent) => {
    switch (e.type) {
      case 'born': showToast(T.born, 'good'); break;
      case 'sick': showToast(T.sick, 'error'); break;
      case 'safetyNet':
        // same rule as core updateSafetyNet: seeds when wheat can be planted, otherwise wheat + coins
        showToast(canPlantNow(controller.state, 'wheat').ok ? T.safetyNet : T.safetyNetWinter, 'good');
        break;
      case 'gain': {
        const parts = [];
        if (e.qty) parts.push({ text: T.plus(e.qty), icon: e.item ? itemIcon(e.item) : undefined });
        if (e.coins) parts.push({ text: T.plus(e.coins), icon: 'icon-coin' });
        if (e.xp) parts.push({ text: T.gainXp(e.xp), icon: 'icon-star' });
        scene.floatText(e.x, e.y, parts, e.animalId);
        break;
      }
      default: break;
    }
  });
}
