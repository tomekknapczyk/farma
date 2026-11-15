/** Hidden parent menu: hold the coin display for 3 s. Backup export/import, new game, debug level-up. */
import { addXp } from '../core/economy';
import { xpToNext } from '../core/config';
import type { ActionResult } from '../core/types';
import type { GameController } from '../game/controller';
import { T } from './copy';
import { btn, closeModal, el, openModal } from './dom';
import { showToast } from './toast';

export const HOLD_MS = 3000;
const MOVE_PX = 10;

export function mountParentMenu(controller: GameController, target: HTMLElement, debug: boolean): void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let sx = 0;
  let sy = 0;
  const cancel = () => {
    if (timer !== null) { clearTimeout(timer); timer = null; }
    target.classList.remove('holding');
  };
  target.addEventListener('pointerdown', (e) => {
    cancel();
    sx = e.clientX; sy = e.clientY;
    target.classList.add('holding');
    timer = setTimeout(() => {
      cancel();
      openMenu(controller, debug);
    }, HOLD_MS);
  });
  target.addEventListener('pointermove', (e) => {
    if (timer !== null && Math.hypot(e.clientX - sx, e.clientY - sy) > MOVE_PX) cancel();
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) target.addEventListener(ev, cancel);
  target.addEventListener('contextmenu', (e) => e.preventDefault());
}

function openMenu(controller: GameController, debug: boolean): void {
  const m = openModal(T.parent.title);
  const input = el('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.hidden = true;
  input.addEventListener('change', async () => {
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    const ok = await controller.importSave(f);
    showToast(ok ? T.parent.loaded : T.parent.badFile, ok ? 'good' : 'error');
    if (ok) closeModal();
  });

  let confirmStep = 0; // 0 = idle, 1 = "Na pewno?", 2 = "Tak, nowa gra"
  const newGameBox = el('div', 'parent-new');
  const renderNew = () => {
    newGameBox.replaceChildren();
    const label = [T.parent.newGame, T.parent.sure, T.parent.yesNew][confirmStep];
    newGameBox.append(btn({
      label, cls: `wide-btn${confirmStep > 0 ? ' danger' : ''}`,
      onTap: () => {
        if (confirmStep < 2) { confirmStep++; renderNew(); return; }
        controller.reset((Math.random() * 2 ** 32) | 0);
        closeModal();
      },
    }));
    if (confirmStep > 0) newGameBox.append(btn({ label: T.cancel, cls: 'wide-btn', onTap: () => { confirmStep = 0; renderNew(); } }));
  };
  renderNew();

  m.body.append(
    btn({ label: T.parent.save, cls: 'wide-btn', onTap: () => controller.exportSave() }),
    btn({ label: T.parent.load, cls: 'wide-btn', onTap: () => input.click() }),
    input,
    newGameBox,
  );
  if (debug) {
    m.body.append(btn({
      label: T.parent.levelUp, cls: 'wide-btn',
      onTap: () => {
        const grant = (s: typeof controller.state, ctx: typeof controller.ctx): ActionResult => {
          addXp(s, ctx, xpToNext(s.level));
          return { ok: true };
        };
        controller.act(grant);
      },
    }));
  }
}
