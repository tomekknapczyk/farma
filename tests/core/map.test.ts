import { describe, expect, it } from 'vitest';
import { buyParcel, canPlace, isTileUnlocked, nextParcelCost, parcelAdjacent, parcelOf, tileOccupant } from '../../src/core/map';
import { createInitialState } from '../../src/core/state';
import { ctx, expectUnchanged, newTestState } from '../../src/core/testutil';

describe('map', () => {
  it('parcelOf and unlocked tiles', () => {
    const s = newTestState();
    expect(parcelOf(5, 5)).toBe(5);
    expect(parcelOf(15, 15)).toBe(15);
    expect(isTileUnlocked(s, 5, 5)).toBe(true);
    expect(isTileUnlocked(s, 0, 0)).toBe(false);
    expect(isTileUnlocked(s, -1, 5)).toBe(false);
    expect(isTileUnlocked(s, 16, 5)).toBe(false);
  });
  it('tileOccupant and canPlace', () => {
    const s = newTestState();
    expect(tileOccupant(s, 5, 5)?.kind).toBe('field');
    expect(tileOccupant(s, 7, 7)).toBeNull();
    expect(canPlace(s, 7, 7, 1, 1)).toBe(true);
    expect(canPlace(s, 5, 5, 1, 1)).toBe(false);
    expect(canPlace(s, 7, 7, 2, 2)).toBe(false); // spills into locked parcel
    expect(canPlace(s, 4, 4, 2, 2)).toBe(false); // (4,4) locked
  });
  it('buildings occupy 2x2', () => {
    const s = newTestState();
    s.buildings.push({ id: 'b1', kind: 'coop', x: 4, y: 6, upgraded: false, trough: 0 });
    expect(tileOccupant(s, 5, 7)?.kind).toBe('building');
    expect(canPlace(s, 5, 7, 1, 1)).toBe(false);
  });
  it('buyParcel requires level', () => {
    const s = newTestState({ coins: 200 });
    expectUnchanged(s, () => buyParcel(s, ctx(), 6), 'locked');
  });
  it('buyParcel at level 2', () => {
    const s = newTestState({ coins: 200, level: 2 });
    expect(buyParcel(s, ctx(), 6)).toEqual({ ok: true });
    expect(s.coins).toBe(100);
    expect(s.parcels[6]).toBe(true);
    expect(s.xp).toBe(5);
  });
  it('rejects non-adjacent, owned, out-of-range, no money', () => {
    const s = newTestState({ coins: 200, level: 2 });
    expectUnchanged(s, () => buyParcel(s, ctx(), 15), 'invalid');
    expectUnchanged(s, () => buyParcel(s, ctx(), 5), 'invalid');
    expectUnchanged(s, () => buyParcel(s, ctx(), 16), 'invalid');
    s.coins = 99;
    expectUnchanged(s, () => buyParcel(s, ctx(), 6), 'no-money');
  });
});

describe('parcelAdjacent / nextParcelCost', () => {
  it('only unowned parcels sharing an edge with owned land are adjacent', () => {
    const s = createInitialState(1); // owns parcel 5 (px=1, py=1)
    expect([1, 4, 6, 9].every((i) => parcelAdjacent(s, i))).toBe(true);
    expect(parcelAdjacent(s, 5)).toBe(false); // owned
    expect(parcelAdjacent(s, 0)).toBe(false); // diagonal
    expect(parcelAdjacent(s, 7)).toBe(false); // two away
    expect(parcelAdjacent(s, 16)).toBe(false);
  });
  it('next price doubles with each bought parcel', () => {
    const s = createInitialState(1);
    expect(nextParcelCost(s)).toBe(100);
    s.parcels[6] = true;
    expect(nextParcelCost(s)).toBe(200);
  });
});
