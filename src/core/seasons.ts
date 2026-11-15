import { SEASON_MS, TRANSITION_MS } from './config';
import type { Season } from './types';

const ORDER: Season[] = ['spring', 'summer', 'autumn', 'winter'];
const MAIN_LABEL: Record<Season, string> = { spring: 'Wiosna', summer: 'Lato', autumn: 'Jesień', winter: 'Zima' };
const TRANSITION_LABEL: Record<Season, string> = {
  spring: 'Późna wiosna', summer: 'Wczesna jesień', autumn: 'Przedzimie', winter: 'Roztopy',
};
const PHASE_MS = SEASON_MS + TRANSITION_MS;

export interface SeasonInfo {
  season: Season; inTransition: boolean; next: Season; transitionProgress: number; label: string;
}

/** During a transition `season` is the previous season; `next` is the upcoming one. */
export function getSeasonInfo(timeMs: number): SeasonInfo {
  const t = ((timeMs % (4 * PHASE_MS)) + 4 * PHASE_MS) % (4 * PHASE_MS);
  const idx = Math.floor(t / PHASE_MS);
  const within = t - idx * PHASE_MS;
  const season = ORDER[idx];
  const next = ORDER[(idx + 1) % 4];
  if (within >= SEASON_MS) {
    return {
      season, inTransition: true, next,
      transitionProgress: (within - SEASON_MS) / TRANSITION_MS,
      label: TRANSITION_LABEL[season],
    };
  }
  return { season, inTransition: false, next, transitionProgress: 0, label: MAIN_LABEL[season] };
}
