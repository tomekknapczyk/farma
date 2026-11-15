import { describe, expect, it } from 'vitest';
import { rollWeather, updateWeather } from '../../src/core/weather';
import { ctx, newTestState } from '../../src/core/testutil';

const rng = (v: number) => ({ next: () => v });

describe('rollWeather', () => {
  it('uses cumulative thresholds', () => {
    expect(rollWeather('summer', rng(0.7))).toBe('heat');
    expect(rollWeather('winter', rng(0.7))).toBe('snow');
    expect(rollWeather('spring', rng(0.1))).toBe('sun');
  });
  it('never returns kinds outside the season table', () => {
    for (let i = 0; i < 100; i++) {
      const k = rollWeather('winter', rng(i / 100));
      expect(['sun', 'snow']).toContain(k);
    }
  });
});

describe('updateWeather', () => {
  it('does nothing before untilMs', () => {
    const s = newTestState({ timeMs: 1000 });
    const c = ctx();
    updateWeather(s, c);
    expect(s.weather).toEqual({ kind: 'sun', untilMs: 180000 });
    expect(c.events).toEqual([]);
  });
  it('rerolls with duration and emits on kind change', () => {
    const s = newTestState({ timeMs: 180000 });
    const c = ctx([0.99, 0]);
    updateWeather(s, c); // spring, 0.99 -> rain; duration from 0 -> min
    expect(s.weather.kind).toBe('rain');
    expect(s.weather.untilMs).toBe(180000 + 180000 + 0.0 * 120000);
    expect(c.events).toEqual([{ type: 'weatherChanged', kind: 'rain' }]);
  });
  it('does not emit if kind is unchanged', () => {
    const s = newTestState({ timeMs: 180000 });
    const c = ctx([0, 0.5]);
    updateWeather(s, c);
    expect(s.weather.kind).toBe('sun');
    expect(s.weather.untilMs).toBe(180000 + 240000);
    expect(c.events).toEqual([]);
  });
});
