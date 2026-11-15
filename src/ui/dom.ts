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

/**
 * Re-renders `render` into `target` whenever the controller notifies and `key()` changed.
 * Skipping unchanged keys keeps buttons stable under the finger (notify runs every 250 ms).
 * `refresh()` re-renders now (after local UI state changed); `stop()` unsubscribes.
 */
export function live(
  sub: (fn: () => void) => () => void, key: () => string, target: HTMLElement, render: (into: HTMLElement) => void,
): { refresh(): void; stop(): void } {
  let last: string | null = null;
  // never swap buttons while a finger is down on them (the click would be lost); catch up on release
  let pressed = false;
  let pending = false;
  const run = (force: boolean) => {
    const k = key();
    if (!force && k === last) return;
    if (pressed && !force) { pending = true; return; }
    last = k;
    pending = false;
    target.replaceChildren();
    render(target);
  };
  const down = () => { pressed = true; };
  const up = () => {
    pressed = false;
    if (pending) setTimeout(() => run(false), 0); // after the click event of this press
  };
  target.addEventListener('pointerdown', down);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
  run(true);
  const unsub = sub(() => run(false));
  const stop = () => {
    unsub();
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
  };
  return { refresh: () => run(true), stop };
}
