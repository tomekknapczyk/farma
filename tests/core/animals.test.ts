import { describe, expect, it } from 'vitest';
import {
  animalStatus, buildBuilding, buyAnimal, callVet, capacity, collectProduct, fillTrough, giveTreat, troughCap,
  updateAnimals, upgradeBuilding,
} from '../../src/core/animals';
import { createRng } from '../../src/core/rng';
import { tick } from '../../src/core/tick';
import { ctx, expectUnchanged, newTestState } from '../../src/core/testutil';
import type { Animal } from '../../src/core/types';

function coopState(chickens = 1, patch = {}) {
  const s = newTestState({ level: 3, coins: 1000, parcels: new Array(16).fill(true), ...patch });
  expect(buildBuilding(s, ctx(), 'coop', 0, 0)).toEqual({ ok: true });
  const id = s.buildings[0].id;
  for (let i = 0; i < chickens; i++) expect(buyAnimal(s, ctx(), 'chicken', id)).toEqual({ ok: true });
  return { s, id };
}
function run(s: ReturnType<typeof newTestState>, c: ReturnType<typeof ctx>, ms: number) {
  for (let i = 0; i < ms / 1000; i++) tick(s, c, 1000);
}

describe('buildings', () => {
  it('builds a coop at level 3 for 60', () => {
    const s = newTestState({ level: 3, coins: 100, parcels: new Array(16).fill(true) });
    expect(buildBuilding(s, ctx(), 'coop', 0, 0)).toEqual({ ok: true });
    expect(s.coins).toBe(40);
    expect(s.xp).toBe(5);
    expect(s.buildings[0]).toMatchObject({ kind: 'coop', trough: 0, upgraded: false });
    expectUnchanged(s, () => buildBuilding(s, ctx(), 'coop', 1, 1), 'occupied');
  });
  it('locked at level 1, no-money', () => {
    const s = newTestState({ level: 1, coins: 100, parcels: new Array(16).fill(true) });
    expectUnchanged(s, () => buildBuilding(s, ctx(), 'coop', 0, 0), 'locked');
    const p = newTestState({ level: 2, coins: 10, parcels: new Array(16).fill(true) });
    expectUnchanged(p, () => buildBuilding(p, ctx(), 'coop', 0, 0), 'no-money');
  });
  it('upgrade at level 9 once', () => {
    const { s, id } = coopState(0, { level: 9 });
    expect(upgradeBuilding(s, ctx(), id)).toEqual({ ok: true });
    expect(capacity(s.buildings[0])).toBe(8);
    expect(troughCap(s.buildings[0])).toBe(20);
    expectUnchanged(s, () => upgradeBuilding(s, ctx(), id), 'invalid');
  });
  it('upgrade locked below level 9', () => {
    const { s, id } = coopState(0);
    expectUnchanged(s, () => upgradeBuilding(s, ctx(), id), 'locked');
  });
});

describe('animals', () => {
  it('fifth chicken is rejected', () => {
    const { s, id } = coopState(4);
    expectUnchanged(s, () => buyAnimal(s, ctx(), 'chicken', id), 'full');
  });
  it('fillTrough rules', () => {
    const { s, id } = coopState(0);
    s.storage.corn = 5;
    expectUnchanged(s, () => fillTrough(s, ctx(), id, 'corn', 5), 'invalid');
    expectUnchanged(s, () => fillTrough(s, ctx(), id, 'wheat', 5), 'no-item');
    s.storage.wheat = 12;
    expect(fillTrough(s, ctx(), id, 'wheat', 12)).toEqual({ ok: true, n: 10 });
    expect(s.storage.wheat).toBe(2);
    expect(s.buildings[0].trough).toBe(10);
    expectUnchanged(s, () => fillTrough(s, ctx(), id, 'wheat', 2), 'full');
  });
  it('fillTrough grants XP.feed once per successful call, none when rejected', () => {
    const { s, id } = coopState(0);
    s.storage.wheat = 12;
    const xp = s.xp;
    expect(fillTrough(s, ctx(), id, 'wheat', 5)).toEqual({ ok: true, n: 5 });
    expect(s.xp).toBe(xp + 1);
    expect(fillTrough(s, ctx(), id, 'wheat', 7)).toEqual({ ok: true, n: 5 });
    expect(s.xp).toBe(xp + 2);
    expectUnchanged(s, () => fillTrough(s, ctx(), id, 'wheat', 2), 'full');
    expect(s.xp).toBe(xp + 2);
  });
  it('fed chicken produces after 90s', () => {
    const { s, id } = coopState(1);
    s.storage.wheat = 10;
    fillTrough(s, ctx(), id, 'wheat', 10);
    run(s, ctx(), 90000);
    expect(s.animals[0].productReady).toBe(true);
    expect(s.buildings[0].trough).toBe(9);
    expect(animalStatus(s.animals[0])).toBe('ready');
  });
  it('unfed chicken is hungry', () => {
    const { s } = coopState(1);
    run(s, ctx(), 200000);
    expect(animalStatus(s.animals[0])).toBe('hungry');
    expect(s.animals[0].productReady).toBe(false);
  });
  it('collectProduct', () => {
    const { s, id } = coopState(1);
    s.storage.wheat = 10;
    fillTrough(s, ctx(), id, 'wheat', 10);
    run(s, ctx(), 90000);
    const c = ctx();
    const xp = s.xp;
    expect(collectProduct(s, c, s.animals[0].id)).toEqual({ ok: true });
    expect(s.storage.egg).toBe(1);
    expect(s.xp).toBe(xp + 2);
    expect(c.events).toContainEqual({ type: 'gain', x: 0, y: 0, item: 'egg', qty: 1, xp: 2 });
    expectUnchanged(s, () => collectProduct(s, ctx(), s.animals[0].id), 'not-ready');
  });
  it('sickness stops production, vet heals', () => {
    const { s, id } = coopState(1);
    s.storage.wheat = 10;
    fillTrough(s, ctx(), id, 'wheat', 10);
    const c = ctx([0.01]);
    run(s, c, 90000);
    expect(s.animals[0].sick).toBe(true);
    expect(c.events).toContainEqual({ type: 'sick', animalId: s.animals[0].id });
    collectProduct(s, ctx(), s.animals[0].id);
    run(s, ctx([0.99]), 200000);
    expect(s.animals[0].productReady).toBe(false);
    expect(animalStatus(s.animals[0])).toBe('sick');
    expectUnchanged(s, () => giveTreat(s, ctx(), s.animals[0].id), 'sick');
    s.coins = 14;
    expectUnchanged(s, () => callVet(s, ctx(), s.animals[0].id), 'no-money');
    s.coins = 15;
    expect(callVet(s, ctx(), s.animals[0].id)).toEqual({ ok: true });
    expect(s.coins).toBe(0);
    expect(s.animals[0].sick).toBe(false);
    expectUnchanged(s, () => callVet(s, ctx(), s.animals[0].id), 'invalid');
  });
  it('births a young that does not produce until grown', () => {
    const { s, id } = coopState(2);
    s.storage.wheat = 10;
    fillTrough(s, ctx(), id, 'wheat', 10);
    const c = ctx([0.05]);
    run(s, c, 90000);
    const young = s.animals.filter((a) => a.bornOnFarm);
    expect(young.length).toBeGreaterThanOrEqual(1);
    expect(young[0]).toMatchObject({ youngMsLeft: 120000, breed: null, species: 'chicken' });
    expect(c.events.some((e) => e.type === 'born')).toBe(true);
    expect(animalStatus(young[0])).toBe('young');
    run(s, ctx([0.99]), 119000);
    expect(young[0].productReady).toBe(false);
    expect(young[0].youngMsLeft).toBeGreaterThan(0);
  });
  it('no birth in a full coop', () => {
    const { s, id } = coopState(4);
    s.storage.wheat = 10;
    fillTrough(s, ctx(), id, 'wheat', 10);
    run(s, ctx([0.05]), 90000);
    expect(s.animals.length).toBe(4);
  });
  it('no birth with fewer than two healthy adults', () => {
    const { s, id } = coopState(1);
    s.storage.wheat = 10;
    fillTrough(s, ctx(), id, 'wheat', 10);
    run(s, ctx([0.05]), 90000);
    expect(s.animals.length).toBe(1);
  });
  it('treat speeds cycle to 45s and is consumed', () => {
    const { s, id } = coopState(1);
    s.storage.wheat = 10;
    s.storage.carrot = 1;
    fillTrough(s, ctx(), id, 'wheat', 10);
    expect(giveTreat(s, ctx(), s.animals[0].id)).toEqual({ ok: true });
    expect(s.storage.carrot).toBe(0);
    expectUnchanged(s, () => giveTreat(s, ctx(), s.animals[0].id), 'invalid');
    run(s, ctx(), 45000);
    expect(s.animals[0].productReady).toBe(true);
    expect(s.animals[0].treat).toBe(false);
  });
  it('treat without carrot', () => {
    const { s } = coopState(1);
    expectUnchanged(s, () => giveTreat(s, ctx(), s.animals[0].id), 'no-item');
  });
  it('never removes animals', () => {
    const { s, id } = coopState(4, { level: 9 });
    upgradeBuilding(s, ctx(), id);
    const rng = createRng(7);
    const c = { rng, events: [] as never[] };
    s.buildings[0].trough = 20;
    const start = s.animals.length;
    let min = start;
    for (let i = 0; i < 10000; i++) {
      if (i % 50 === 0) {
        s.buildings[0].trough = 20;
        for (const a of s.animals) if (a.sick && rng.next() < 0.5) a.sick = false;
      }
      tick(s, c, 1000);
      min = Math.min(min, s.animals.length);
    }
    expect(min).toBeGreaterThanOrEqual(start);
    expect(s.animals.length).toBeGreaterThanOrEqual(start);
  });
});

describe('updateAnimals direct', () => {
  it('horse birth inherits breed and registers it', () => {
    const s = newTestState({ level: 7, coins: 1000, parcels: new Array(16).fill(true) });
    buildBuilding(s, ctx(), 'stable', 0, 0);
    const b = s.buildings[0];
    b.trough = 10;
    const mk = (id: string, breed: 'pony' | 'arabian'): Animal => ({
      id, species: 'horse', breed, buildingId: b.id, youngMsLeft: 0, sick: false, cycleMs: 119999,
      productReady: false, treat: false, bornOnFarm: false,
    });
    s.animals.push(mk('h1', 'pony'), mk('h2', 'arabian'));
    updateAnimals(s, ctx([0.05]), 1);
    const foal = s.animals.find((a) => a.bornOnFarm);
    expect(foal).toBeDefined();
    expect(foal!.youngMsLeft).toBe(300000);
    expect(s.ownedBreeds).toContain(foal!.breed);
  });
});
