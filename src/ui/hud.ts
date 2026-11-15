/** Top bar: coins, XP bar with level, weather icon, season label. */
import { xpProgress } from '../core/economy';
import { getSeasonInfo } from '../core/seasons';
import { textureFor } from '../art/registry';
import type { GameController } from '../game/controller';
import { el } from './dom';
import { icon, iconUrl } from './icons';

export function mountHud(root: HTMLElement, controller: GameController): HTMLElement {
  const coins = el('span', 'hud-num');
  const level = el('span', 'hud-level');
  const fill = el('div', 'xp-fill');
  const weather = icon('icon-sun', 'hud-icon');
  const seasonIcon = icon('tree', 'hud-icon tall');
  const season = el('span', 'hud-season');

  const coinPill = el('div', 'pill coins', icon('icon-coin', 'hud-icon'), coins);
  const bar = el('div', 'hud',
    coinPill,
    el('div', 'pill xp', icon('icon-star', 'hud-icon'), level, el('div', 'xp-bar', fill)),
    el('div', 'spacer'),
    el('div', 'pill', weather, seasonIcon, season),
  );
  root.append(bar);

  let last = '';
  const render = () => {
    const s = controller.state;
    const xp = xpProgress(s);
    const info = getSeasonInfo(s.timeMs);
    const pct = Math.round((xp.current / xp.needed) * 100);
    const key = [s.coins, xp.level, pct, s.weather.kind, info.label, info.season].join('|');
    if (key === last) return;
    last = key;
    coins.textContent = String(s.coins);
    level.textContent = String(xp.level);
    fill.style.width = `${pct}%`;
    weather.src = iconUrl(`icon-${s.weather.kind}`);
    seasonIcon.src = iconUrl(textureFor('tree', info.season));
    season.textContent = info.label;
  };
  render();
  controller.subscribe(render);
  return coinPill;
}
