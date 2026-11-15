import { describe, expect, it } from 'vitest';
import { buildField, canPlantNow, cropStage, harvest, isReady, plant, water } from '../../src/core/crops';
import { tick } from '../../src/core/tick';
import { ctx, expectUnchanged, newTestState } from '../../src/core/testutil';

const WINTER = 11_700_000 + 1000;
function run(s: ReturnType<typeof newTestState>, c: ReturnType<typeof ctx>, ms: number) {
  for (let i = 0; i < ms / 1000; i++) tick(s, c, 1000);
}

describe('crops', () => {
  it('plant wheat', () => {
    const s = newTestState();
    expect(plant(s, ctx(), 'f1', 'wheat')).toEqual({ ok: true });
    expect(s.coins).toBe(45);
    expect(s.xp).toBe(1);
    expect(s.fields[0].crop).toBe('wheat');
    expectUnchanged(s, () => plant(s, ctx(), 'f1', 'wheat'), 'occupied');
  });
  it('plant rejections', () => {
    const s = newTestState();
    expectUnchanged(s, () => plant(s, ctx(), 'f1', 'corn'), 'locked');
    expectUnchanged(s, () => plant(s, ctx(), 'nope', 'wheat'), 'invalid');
    const w = newTestState({ timeMs: WINTER });
    expectUnchanged(w, () => plant(w, ctx(), 'f1', 'wheat'), 'out-of-season');
    expect(canPlantNow(w, 'wheat')).toEqual({ ok: false, reason: 'out-of-season' });
    const p = newTestState({ coins: 3 });
    expectUnchanged(p, () => plant(p, ctx(), 'f1', 'wheat'), 'no-money');
  });
  it('free seeds used first', () => {
    const s = newTestState();
    s.freeSeeds.wheat = 1;
    expect(plant(s, ctx(), 'f1', 'wheat').ok).toBe(true);
    expect(s.coins).toBe(50);
    expect(s.freeSeeds.wheat).toBe(0);
  });
  it('grows and harvests', () => {
    const s = newTestState();
    const c = ctx();
    plant(s, c, 'f1', 'wheat');
    run(s, c, 29000);
    expect(isReady(s.fields[0])).toBe(false);
    expectUnchanged(s, () => harvest(s, c, 'f1'), 'not-ready');
    run(s, c, 1000);
    expect(isReady(s.fields[0])).toBe(true);
    expect(cropStage(s.fields[0])).toBe(3);
  });
  it('harvest yield watered vs not', () => {
    const s = newTestState();
    const c = ctx();
    plant(s, c, 'f1', 'wheat');
    plant(s, c, 'f2', 'wheat');
    expect(water(s, c, 'f1')).toEqual({ ok: true });
    expectUnchanged(s, () => water(s, c, 'f1'), 'invalid');
    run(s, c, 30000);
    expect(harvest(s, c, 'f1')).toEqual({ ok: true, n: 3 });
    expect(harvest(s, c, 'f2')).toEqual({ ok: true, n: 1 });
    expect(s.storage.wheat).toBe(4);
    expect(c.events.find((e) => e.type === 'gain')).toMatchObject({ x: 5, y: 5, item: 'wheat', qty: 3, xp: 2 });
    expect(s.fields[0]).toMatchObject({ crop: null, growthMs: 0, watered: false });
    expectUnchanged(s, () => harvest(s, c, 'f1'), 'invalid');
  });
  it('heat speeds growth', () => {
    const s = newTestState();
    s.weather = { kind: 'heat', untilMs: 1e9 };
    const c = ctx();
    plant(s, c, 'f1', 'wheat');
    run(s, c, 24000);
    expect(isReady(s.fields[0])).toBe(false);
    run(s, c, 1000);
    expect(isReady(s.fields[0])).toBe(true);
  });
  it('rain waters growing fields', () => {
    const s = newTestState();
    const c = ctx();
    plant(s, c, 'f1', 'wheat');
    s.weather = { kind: 'rain', untilMs: 1e9 };
    tick(s, c, 1000);
    expect(s.fields[0].watered).toBe(true);
    expect(s.fields[1].watered).toBe(false);
    const r = newTestState();
    r.weather = { kind: 'rain', untilMs: 1e9 };
    plant(r, c, 'f1', 'wheat');
    expect(r.fields[0].watered).toBe(true);
  });
  it('buildField', () => {
    const s = newTestState();
    expectUnchanged(s, () => buildField(s, ctx(), 0, 0), 'locked');
    expectUnchanged(s, () => buildField(s, ctx(), 5, 5), 'occupied');
    expect(buildField(s, ctx(), 7, 7)).toEqual({ ok: true });
    expect(s.coins).toBe(40);
    expect(s.fields).toHaveLength(5);
    const p = newTestState({ coins: 5 });
    expectUnchanged(p, () => buildField(p, ctx(), 7, 7), 'no-money');
  });
  it('cropStage thresholds', () => {
    const f = { id: 'x', x: 0, y: 0, crop: 'wheat' as const, growthMs: 0, watered: false };
    expect(cropStage({ ...f, crop: null })).toBe(0);
    expect(cropStage(f)).toBe(0);
    expect(cropStage({ ...f, growthMs: 10000 })).toBe(1);
    expect(cropStage({ ...f, growthMs: 20000 })).toBe(2);
    expect(cropStage({ ...f, growthMs: 30000 })).toBe(3);
  });
});
