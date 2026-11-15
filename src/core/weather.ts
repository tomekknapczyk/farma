import { WEATHER_MAX_MS, WEATHER_MIN_MS, WEATHER_TABLE } from './config';
import { getSeasonInfo } from './seasons';
import type { Ctx, GameState, Rng, Season, WeatherKind } from './types';

// Fixed iteration order for cumulative thresholds (independent of table key order).
const KIND_ORDER: WeatherKind[] = ['sun', 'heat', 'rain', 'snow'];

export function rollWeather(season: Season, rng: Rng): WeatherKind {
  const table = WEATHER_TABLE[season];
  const r = rng.next();
  let acc = 0;
  let last: WeatherKind = 'sun';
  for (const kind of KIND_ORDER) {
    const p = table[kind];
    if (p === undefined) continue;
    acc += p;
    last = kind;
    if (r < acc) return kind;
  }
  return last;
}

export function updateWeather(s: GameState, ctx: Ctx): void {
  if (s.timeMs < s.weather.untilMs) return;
  const { season } = getSeasonInfo(s.timeMs);
  const kind = rollWeather(season, ctx.rng);
  const duration = WEATHER_MIN_MS + ctx.rng.next() * (WEATHER_MAX_MS - WEATHER_MIN_MS);
  const changed = kind !== s.weather.kind;
  s.weather = { kind, untilMs: s.timeMs + duration };
  if (changed) ctx.events.push({ type: 'weatherChanged', kind });
}
