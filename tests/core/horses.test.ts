import { describe, expect, it } from 'vitest';
import { animalStatus, buildBuilding, fillTrough } from '../../src/core/animals';
import { buyHorse, inheritBreed, sellHorse } from '../../src/core/horses';
import { tick } from '../../src/core/tick';
import { ctx, expectUnchanged, newTestState } from '../../src/core/testutil';
import type { Animal, BreedId } from '../../src/core/types';

function stableState(level = 7, coins = 1000) {
  const s = newTestState({ level, coins, parcels: new Array(16).fill(true) });
  s.buildings.push({ id: 'b1', kind: 'stable', x: 0, y: 0, upgraded: false, trough: 0 });
  return { s, id: 'b1' };
}
function horse(breed: BreedId, patch: Partial<Animal> = {}): Animal {
  return {
    id: 'h' + breed, species: 'horse', breed, buildingId: 'b1', youngMsLeft: 0, sick: false, cycleMs: -1,
    productReady: false, treat: false, bornOnFarm: false, ...patch,
  };
}

describe('buyHorse', () => {
  it('pony locked at level 4, ok at level 5 for 300', () => {
    const six = stableState(4, 1000);
    expectUnchanged(six.s, () => buyHorse(six.s, ctx(), 'pony', six.id), 'locked');
    const { s, id } = stableState(5, 300);
    expect(buyHorse(s, ctx(), 'pony', id)).toEqual({ ok: true });
    expect(s.coins).toBe(0);
    expect(s.ownedBreeds).toEqual(['pony']);
    expect(s.animals[0]).toMatchObject({ species: 'horse', breed: 'pony', youngMsLeft: 0, cycleMs: -1, bornOnFarm: false });
  });
  it('arabian locked at level 7', () => {
    const { s, id } = stableState(7, 1000);
    expectUnchanged(s, () => buyHorse(s, ctx(), 'arabian', id), 'locked');
  });
  it('invalid building, full, no-money', () => {
    const { s, id } = stableState(7, 1000);
    expectUnchanged(s, () => buyHorse(s, ctx(), 'pony', 'nope'), 'invalid');
    s.buildings.push({ id: 'c1', kind: 'coop', x: 4, y: 4, upgraded: false, trough: 0 });
    expectUnchanged(s, () => buyHorse(s, ctx(), 'pony', 'c1'), 'invalid');
    for (let i = 0; i < 3; i++) expect(buyHorse(s, ctx(), 'pony', id)).toEqual({ ok: true });
    expectUnchanged(s, () => buyHorse(s, ctx(), 'pony', id), 'full');
    const p = stableState(7, 100);
    expectUnchanged(p.s, () => buyHorse(p.s, ctx(), 'pony', p.id), 'no-money');
  });
  it('builds a stable via buildBuilding at level 7', () => {
    const s = newTestState({ level: 7, coins: 400, parcels: new Array(16).fill(true) });
    expect(buildBuilding(s, ctx(), 'stable', 0, 0)).toEqual({ ok: true });
  });
});

describe('inheritBreed', () => {
  const parents = [horse('pony'), horse('arabian')];
  it('final draw < 0.5 picks parent A, otherwise B', () => {
    expect(inheritBreed(parents, ctx([0, 0, 0.2]).rng)).toBe('pony');
    expect(inheritBreed(parents, ctx([0, 0, 0.7]).rng)).toBe('arabian');
  });
});

describe('sellHorse', () => {
  it('young foal: young, unchanged', () => {
    const { s } = stableState();
    s.animals.push(horse('pony', { youngMsLeft: 1000 }));
    expectUnchanged(s, () => sellHorse(s, ctx(), 'hpony'), 'young');
  });
  it('invalid for unknown id or non-horse', () => {
    const { s } = stableState();
    s.animals.push({ ...horse('pony'), id: 'c', species: 'chicken', breed: null });
    expectUnchanged(s, () => sellHorse(s, ctx(), 'zzz'), 'invalid');
    expectUnchanged(s, () => sellHorse(s, ctx(), 'c'), 'invalid');
  });
  it('adult arabian: +500 coins, +10 xp, breed remembered, horse removed, gain event', () => {
    const { s } = stableState(8, 0);
    s.ownedBreeds = ['arabian'];
    s.animals.push(horse('arabian'));
    const c = ctx();
    expect(sellHorse(s, c, 'harabian')).toEqual({ ok: true });
    expect(s.coins).toBe(500);
    expect(s.xp).toBe(10);
    expect(s.animals).toHaveLength(0);
    expect(s.ownedBreeds).toContain('arabian');
    expect(c.events).toContainEqual({ type: 'gain', x: 0, y: 0, coins: 500, xp: 10 });
  });
});

describe('horse cycle', () => {
  it('horse with carrot completes the 120s cycle and never has productReady', () => {
    const { s, id } = stableState();
    s.animals.push(horse('pony'));
    s.storage.carrot = 5;
    expect(fillTrough(s, ctx(), id, 'carrot', 5).ok).toBe(true);
    const c = ctx([0.99]);
    for (let i = 0; i < 119; i++) tick(s, c, 1000);
    expect(s.animals[0].cycleMs).toBeGreaterThan(0);
    tick(s, c, 1000);
    expect(s.animals[0].cycleMs).toBe(-1);
    expect(s.animals[0].productReady).toBe(false);
    expect(animalStatus(s.animals[0])).not.toBe('ready');
  });
});
