import { MAX_DT_MS } from './config';
import { updateAnimals } from './animals';
import { updateCrops } from './crops';
import { updateSafetyNet } from './economy';
import { getSeasonInfo } from './seasons';
import type { Ctx, GameState } from './types';
import { updateWeather } from './weather';

export function tick(s: GameState, ctx: Ctx, dtMs: number): void {
  const dt = Math.min(Math.max(dtMs, 0), MAX_DT_MS);
  s.timeMs += dt;

  const { season } = getSeasonInfo(s.timeMs);
  if (season !== s.lastSeason) {
    s.lastSeason = season;
    ctx.events.push({ type: 'seasonChanged', season });
    s.weather.untilMs = s.timeMs; // force a re-roll so weather matches the new season
  }
  updateWeather(s, ctx);
  updateCrops(s, ctx, dt);
  updateAnimals(s, ctx, dt);
  updateSafetyNet(s, ctx);
}
