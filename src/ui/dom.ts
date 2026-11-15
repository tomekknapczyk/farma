/** Tiny DOM helpers shared by the UI modules: elements, big buttons, one modal at a time. */
import { T } from './copy';
import { icon } from './icons';

type Child = Node | string | null | undefined | false;

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', ...children: Child[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  for (const c of children) if (c) e.append(c);
  return e;
}

export interface BtnOpts {
  icon?: string;
  label?: string;
  /** small line under the label, e.g. a price */
  sub?: Node | string;
  onTap: () => void;
  cls?: string;
  /** level needed; when set the button is greyed with a lock and "Od poziomu N" */
  lockedAt?: number;
  disabled?: boolean;
  active?: boolean;
}

export function btn(o: BtnOpts): HTMLButtonElement {
  const b = el('button', `btn ${o.cls ?? ''}`.trim());
  b.type = 'button';
  if (o.icon) b.append(icon(o.icon, 'btn-icon'));
  if (o.label) b.append(el('span', 'btn-label', o.label));
  if (o.lockedAt !== undefined) {
    b.classList.add('locked');
    b.append(icon('icon-lock', 'lock-badge'), el('span', 'btn-sub', T.locked(o.lockedAt)));
  } else if (o.sub !== undefined) {
    b.append(el('span', 'btn-sub', o.sub));
  }
  if (o.disabled) b.classList.add('disabled');
  if (o.active) b.classList.add('active');
  // locked buttons stay tappable so the core action can explain why (toast); disabled ones do nothing
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!o.disabled) o.onTap();
  });
  return b;
}

/** "12 (coin)" price tag. */
export function price(n: number, cls = ''): HTMLSpanElement {
  return el('span', `price ${cls}`.trim(), String(n), icon('icon-coin', 'coin-sm'));
}

let uiRoot: HTMLElement = document.body;
export function setUiRoot(root: HTMLElement): void { uiRoot = root; }
export function getUiRoot(): HTMLElement { return uiRoot; }

export interface Modal { body: HTMLElement; close(): void; onClose(fn: () => void): void }
let current: Modal | null = null;

/** Opens a centred modal, replacing any open one (the level-up dialog has its own layer). */
export function openModal(title: Node | string, titleIcon?: string): Modal {
  current?.close();
  const closers: (() => void)[] = [];
  const backdrop = el('div', 'backdrop');
  const body = el('div', 'modal-body');
  const head = el('div', 'modal-head', titleIcon ? icon(titleIcon, 'title-icon') : null, el('h2', '', title));
  const x = btn({ label: T.closeMark, cls: 'close', onTap: () => m.close() });
  x.setAttribute('aria-label', T.close);
  head.append(x);
  const box = el('div', 'modal', head, body);
  backdrop.append(box);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) m.close(); });
  uiRoot.append(backdrop);
  const m: Modal = {
    body,
    close() {
      if (!backdrop.isConnected) return;
      backdrop.remove();
      if (current === m) current = null;
      for (const fn of closers) fn();
    },
    onClose(fn) { closers.push(fn); },
  };
  current = m;
  return m;
}

export function closeModal(): void { current?.close(); }

/** Fallback catch-up when a press never produces a click (finger slid off, gesture cancelled). */
export const CLICK_WAIT_MS = 400;

/**
 * Re-renders `render` into `target` whenever the controller notifies and `key()` changed.
 * Skipping unchanged keys keeps buttons stable under the finger (notify runs every 250 ms).
 * A re-render is never done while a press on `target` is in progress: it is deferred until that
 * press's `click` has been dispatched (iOS fires the synthetic click asynchronously after touchend,
 * so catching up on pointerup would remove the tapped node first), or CLICK_WAIT_MS after release
 * if no click arrives. `refresh()` re-renders now (after local UI state changed); `stop()` cleans up.
 */
export function live(
  sub: (fn: () => void) => () => void, key: () => string, target: HTMLElement, render: (into: HTMLElement) => void,
): { refresh(): void; stop(): void } {
  let last: string | null = null;
  let pressed = false; // pointer down on target, click not yet dispatched
  let pending = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const draw = (k: string) => {
    last = k;
    pending = false;
    target.replaceChildren();
    render(target);
  };
  const run = () => {
    const k = key();
    if (k === last) return;
    if (pressed) { pending = true; return; }
    draw(k);
  };
  const release = () => {
    if (!pressed) return;
    pressed = false;
    if (timer !== null) { clearTimeout(timer); timer = null; }
    if (pending) setTimeout(run, 0); // after the click handlers of this press have run
  };
  const down = () => {
    pressed = true;
    if (timer !== null) { clearTimeout(timer); timer = null; }
  };
  const up = () => {
    if (pressed && timer === null) timer = setTimeout(release, CLICK_WAIT_MS);
  };
  target.addEventListener('pointerdown', down);
  target.addEventListener('click', release, true); // capture: before buttons stop propagation
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
  draw(key());
  const unsub = sub(run);
  const stop = () => {
    unsub();
    if (timer !== null) clearTimeout(timer);
    target.removeEventListener('pointerdown', down);
    target.removeEventListener('click', release, true);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
  };
  return { refresh: () => draw(key()), stop };
}
