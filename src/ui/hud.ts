/** Top bar: coins, XP bar with level, storage (always visible), weather icon, season label. */
import { xpProgress } from '../core/economy';
import { getSeasonInfo } from '../core/seasons';
import { textureFor } from '../art/registry';
import type { ItemId } from '../core/types';
import type { GameController } from '../game/controller';
import { T } from './copy';
import { el } from './dom';
import { icon, iconUrl, itemIcon } from './icons';

const STORAGE_ITEMS: ItemId[] = ['wheat', 'carrot', 'corn', 'pumpkin', 'egg', 'milk'];

/** `onStorageTap` opens the shop on the sell tab. Returns the coin pill (parent-menu hold target). */
export function mountHud(root: HTMLElement, controller: GameController, onStorageTap: () => void): HTMLElement {
  const coins = el('span', 'hud-num');
  const level = el('span', 'hud-level');
  const fill = el('div', 'xp-fill');
  const weather = icon('icon-sun', 'hud-icon');
  const seasonIcon = icon('tree', 'hud-icon tall');
  const season = el('span', 'hud-season');

  const coinPill = el('div', 'pill coins', icon('icon-coin', 'hud-icon'), coins);

  // built once; render only updates text/classes, so a finger on the bar never loses its node
  const store = el('button', 'pill storage');
  store.type = 'button';
  store.setAttribute('aria-label', T.storage);
  store.addEventListener('click', (e) => { e.stopPropagation(); onStorageTap(); });
  const counts = STORAGE_ITEMS.map((item) => {
    const n = el('span', 'store-num');
    store.append(el('span', 'store-item', icon(itemIcon(item), 'store-icon'), n));
    return { item, n, slot: n.parentElement as HTMLElement, prev: -1 };
  });
  const bar = el('div', 'hud',
    coinPill,
    el('div', 'pill xp', icon('icon-star', 'hud-icon'), level, el('div', 'xp-bar', fill)),
    store,
    el('div', 'spacer'),
    el('div', 'pill', weather, seasonIcon, season),
  );
  root.append(bar);

  let last = '';
  const render = () => {
    const s = controller.state;
    const xp = xpProgress(s);
    const info = getSeasonInfo(s.timeMs);
    const pct = (xp.current / xp.needed) * 100;
    const pctKey = Math.round(pct * 2) / 2; // 0.5% steps: small gains still re-render
    const key = [s.coins, xp.level, pctKey, s.weather.kind, info.label, info.season, ...STORAGE_ITEMS.map((i) => s.storage[i])].join('|');
    if (key === last) return;
    last = key;
    coins.textContent = String(s.coins);
    level.textContent = String(xp.level);
    fill.style.width = `${pct.toFixed(2)}%`;
    weather.src = iconUrl(`icon-${s.weather.kind}`);
    seasonIcon.src = iconUrl(textureFor('tree', info.season));
    season.textContent = info.label;
    for (const c of counts) {
      const v = s.storage[c.item];
      if (v === c.prev) continue;
      c.n.textContent = String(v);
      c.slot.classList.toggle('zero', v === 0);
      if (c.prev >= 0 && v > c.prev) {
        c.slot.classList.remove('bump');
        void c.slot.offsetWidth; // restart the animation
        c.slot.classList.add('bump');
      }
      c.prev = v;
    }
  };
  render();
  controller.subscribe(render);
  return coinPill;
}
