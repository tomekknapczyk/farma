import { describe, expect, it } from 'vitest';
import { SEASON_MS, TRANSITION_MS } from '../../src/core/config';
import { addXp, isUnlocked, sell, spend, unlocksAt, updateSafetyNet, xpProgress } from '../../src/core/economy';
import { tick } from '../../src/core/tick';
import { ctx, expectUnchanged, newTestState } from '../../src/core/testutil';

describe('xp and levels', () => {
  it('30 xp -> level 2, one event', () => {
    const s = newTestState({ xp: 0, level: 1 });
    const c = ctx();
    addXp(s, c, 30);
    expect(s.level).toBe(2);
    expect(c.events.filter((e) => e.type === 'levelUp')).toHaveLength(1);
  });
  it('30+48 xp -> level 3, two events', () => {
    const s = newTestState({ xp: 0, level: 1 });
    const c = ctx();
    addXp(s, c, 78);
    expect(s.level).toBe(3);
    expect(c.events.filter((e) => e.type === 'levelUp')).toHaveLength(2);
  });
  it('capped at MAX_LEVEL but xp grows', () => {
    const s = newTestState({ level: 10, xp: 0 });
    const c = ctx();
    addXp(s, c, 10000);
    expect(s.level).toBe(10);
    expect(s.xp).toBe(10000);
    expect(c.events).toHaveLength(0);
  });
  it('xpProgress', () => {
    const s = newTestState({ xp: 0, level: 1 });
    addXp(s, ctx(), 35);
    expect(xpProgress(s)).toEqual({ level: 2, current: 5, needed: 48 });
  });
});

describe('spend/sell', () => {
  it('spend is atomic', () => {
    const s = newTestState({ coins: 5 });
    expect(spend(s, 6)).toBe(false);
    expect(s.coins).toBe(5);
  });
  it('sell wheat', () => {
    const s = newTestState({ coins: 0 });
    s.storage.wheat = 3;
    expect(sell(s, ctx(), 'wheat', 3)).toEqual({ ok: true, n: 12 });
    expect(s.coins).toBe(12);
    expect(s.storage.wheat).toBe(0);
  });
  it('sell too many', () => {
    const s = newTestState();
    s.storage.wheat = 3;
    expectUnchanged(s, () => sell(s, ctx(), 'wheat', 4), 'no-item');
  });
  it('sell product', () => {
    const s = newTestState({ coins: 0 });
    s.storage.egg = 2;
    expect(sell(s, ctx(), 'egg', 2)).toEqual({ ok: true, n: 16 });
  });
});

describe('unlocks', () => {
  it('corn by level', () => {
    expect(isUnlocked(newTestState({ level: 3 }), { crop: 'corn' })).toBe(false);
    expect(isUnlocked(newTestState({ level: 4 }), { crop: 'corn' })).toBe(true);
  });
  it('misc', () => {
    expect(isUnlocked(newTestState({ level: 1 }), 'parcels')).toBe(false);
    expect(isUnlocked(newTestState({ level: 2 }), 'parcels')).toBe(true);
    expect(isUnlocked(newTestState({ level: 8 }), 'tractor')).toBe(true);
    expect(isUnlocked(newTestState({ level: 8 }), 'upgrade')).toBe(false);
    expect(isUnlocked(newTestState({ level: 9 }), 'upgrade')).toBe(true);
    expect(isUnlocked(newTestState({ level: 7 }), { building: 'stable' })).toBe(true);
    expect(isUnlocked(newTestState({ level: 4 }), { species: 'cow' })).toBe(false);
    expect(isUnlocked(newTestState({ level: 10 }), { breed: 'friesian' })).toBe(true);
  });
  it('unlocksAt table', () => {
    const t: Record<number, string[]> = {
      1: ['crop:wheat'],
      2: ['crop:carrot', 'parcels'],
      3: ['building:coop', 'species:chicken'],
      4: ['crop:corn'],
      5: ['building:barn', 'species:cow'],
      6: ['crop:pumpkin'],
      7: ['building:stable', 'breed:pony'],
      8: ['tractor', 'breed:arabian'],
      9: ['upgrade'],
      10: ['breed:friesian'],
    };
    for (const [lvl, keys] of Object.entries(t)) {
      expect([...unlocksAt(Number(lvl))].sort()).toEqual([...keys].sort());
    }
  });
});

describe('safety net', () => {
  const broke = (patch = {}) => {
    const s = newTestState({ coins: 2, ...patch });
    s.timeMs = 60000;
    s.safetyNetAtMs = 60000;
    for (const f of s.fields) f.crop = null;
    return s;
  };
  it('spring: 4 free wheat seeds', () => {
    const s = broke();
    const c = ctx();
    updateSafetyNet(s, c);
    expect(s.freeSeeds.wheat).toBe(4);
    expect(c.events).toContainEqual({ type: 'safetyNet' });
    expect(s.safetyNetAtMs).toBe(120000);
  });
  it('fires via tick after 60 s', () => {
    const s = newTestState({ coins: 2 });
    for (const f of s.fields) f.crop = null;
    const c = ctx();
    for (let i = 0; i < 61; i++) tick(s, c, 1000);
    expect(s.freeSeeds.wheat).toBe(4);
  });
  it('winter: wheat + coins', () => {
    const s = broke();
    s.timeMs = 3 * (SEASON_MS + TRANSITION_MS) + 60000;
    s.safetyNetAtMs = s.timeMs;
    const c = ctx();
    updateSafetyNet(s, c);
    expect(s.storage.wheat).toBe(5);
    expect(s.coins).toBe(22);
    expect(c.events).toContainEqual({ type: 'safetyNet' });
  });
  it('not with an egg in storage', () => {
    const s = broke();
    s.storage.egg = 1;
    updateSafetyNet(s, ctx());
    expect(s.freeSeeds.wheat).toBe(0);
  });
  it('not with a growing field', () => {
    const s = broke();
    s.fields[0].crop = 'wheat';
    updateSafetyNet(s, ctx());
    expect(s.freeSeeds.wheat).toBe(0);
  });
  it('not with a product ready', () => {
    const s = broke();
    s.animals.push({ id: 'a', species: 'chicken', breed: null, buildingId: 'b', youngMsLeft: 0, sick: false, cycleMs: 0, productReady: true, treat: false, bornOnFarm: false });
    updateSafetyNet(s, ctx());
    expect(s.freeSeeds.wheat).toBe(0);
  });
  it('not when coins suffice', () => {
    const s = broke({ coins: 5 });
    updateSafetyNet(s, ctx());
    expect(s.freeSeeds.wheat).toBe(0);
  });
});
