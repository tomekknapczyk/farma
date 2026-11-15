import { getSeasonInfo } from '../core/seasons';
import type { Season } from '../core/types';

/** Pure colour maths for season looks (no Phaser import, unit-testable). */
export const SEASON_TINT: Record<Season, number> = {
  spring: 0xffffff, summer: 0xfff2c0, autumn: 0xffc890, winter: 0xdfe8ff,
};

/** Linear per-channel RGB blend; t is clamped to 0..1. */
export function blendTint(a: number, b: number, t: number): number {
  const k = Math.min(1, Math.max(0, t));
  let out = 0;
  for (const sh of [16, 8, 0]) {
    const ca = (a >> sh) & 255;
    const cb = (b >> sh) & 255;
    out |= Math.round(ca + (cb - ca) * k) << sh;
  }
  return out;
}

/** Channel-wise multiply of two tints (0xffffff = neutral). */
export function mulTint(a: number, b: number): number {
  let out = 0;
  for (const sh of [16, 8, 0]) out |= Math.round((((a >> sh) & 255) * ((b >> sh) & 255)) / 255) << sh;
  return out;
}

export function currentTint(timeMs: number): number {
  const info = getSeasonInfo(timeMs);
  if (!info.inTransition) return SEASON_TINT[info.season];
  return blendTint(SEASON_TINT[info.season], SEASON_TINT[info.next], info.transitionProgress);
}

/** Snow cover 0..1: in during "Przedzimie", full in winter, out during "Roztopy". */
export function snowAmount(timeMs: number): number {
  const info = getSeasonInfo(timeMs);
  if (info.season === 'autumn' && info.inTransition) return info.transitionProgress;
  if (info.season === 'winter') return info.inTransition ? 1 - info.transitionProgress : 1;
  return 0;
}
