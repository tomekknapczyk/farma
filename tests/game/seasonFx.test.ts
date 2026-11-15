import { describe, expect, it } from 'vitest';
import { SEASON_MS, TRANSITION_MS } from '../../src/core/config';
import { blendTint, currentTint, SEASON_TINT, snowAmount } from '../../src/game/seasonFx';

const near = (a: number, b: number) => {
  for (const sh of [16, 8, 0]) expect(Math.abs(((a >> sh) & 255) - ((b >> sh) & 255))).toBeLessThanOrEqual(1);
};
const PHASE = SEASON_MS + TRANSITION_MS;

describe('seasonFx', () => {
  it('blendTint is linear per channel', () => {
    near(blendTint(0x000000, 0xffffff, 0.5), 0x808080);
    expect(blendTint(0x102030, 0x405060, 0)).toBe(0x102030);
    expect(blendTint(0x102030, 0x405060, 1)).toBe(0x405060);
  });
  it('currentTint(0) is the spring tint', () => {
    expect(currentTint(0)).toBe(SEASON_TINT.spring);
  });
  it('mid "Wczesna jesien" blends summer and autumn 50/50', () => {
    near(currentTint(PHASE + SEASON_MS + TRANSITION_MS / 2), blendTint(SEASON_TINT.summer, SEASON_TINT.autumn, 0.5));
  });
  it('snowAmount: 0 outside winter, ramps in Przedzimie, 1 in winter, ramps out in Roztopy', () => {
    expect(snowAmount(0)).toBe(0);
    expect(snowAmount(2 * PHASE + SEASON_MS + TRANSITION_MS / 2)).toBeCloseTo(0.5);
    expect(snowAmount(3 * PHASE + 1000)).toBe(1);
    expect(snowAmount(3 * PHASE + SEASON_MS + TRANSITION_MS / 4)).toBeCloseTo(0.75);
  });
});
