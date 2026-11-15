import { describe, expect, it } from 'vitest';
import { tick } from '../../src/core/tick';
import { ctx, newTestState } from '../../src/core/testutil';

const MIN = 60_000;

describe('tick', () => {
  it('clamps dt to MAX_DT_MS', () => {
    const s = newTestState();
    tick(s, ctx(), 3_600_000);
    expect(s.timeMs).toBe(1000);
  });
  it('ignores negative dt', () => {
    const s = newTestState();
    tick(s, ctx(), -50);
    expect(s.timeMs).toBe(0);
  });
  it('emits one seasonChanged (summer) over 3900 ticks', () => {
    const s = newTestState();
    const c = ctx();
    for (let i = 0; i < 3900; i++) tick(s, c, 1000);
    const ev = c.events.filter((e) => e.type === 'seasonChanged');
    expect(ev).toEqual([{ type: 'seasonChanged', season: 'summer' }]);
    expect(s.lastSeason).toBe('summer');
  });
  it('season change forces weather reroll: no heat/rain in winter', () => {
    const s = newTestState({
      timeMs: 195 * MIN - 500,
      lastSeason: 'autumn',
      weather: { kind: 'heat', untilMs: 10 ** 12 },
    });
    const c = ctx([0.1, 0.5]);
    tick(s, c, 1000);
    expect(s.lastSeason).toBe('winter');
    expect(['sun', 'snow']).toContain(s.weather.kind);
    for (let i = 0; i < 100; i++) {
      s.weather.untilMs = 0;
      const cc = ctx([(i * 0.37) % 1, 0.5]);
      tick(s, cc, 1000);
      expect(['sun', 'snow']).toContain(s.weather.kind);
    }
  });
});
