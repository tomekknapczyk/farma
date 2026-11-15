import { expect } from 'vitest';
import { createInitialState } from './state';
import type { ActionResult, Ctx, GameState, Reason } from './types';

export function newTestState(patch: Partial<GameState> = {}): GameState {
  return { ...createInitialState(1), ...patch };
}

export function ctx(seq: number[] = [0.99]): Ctx {
  let i = 0;
  return { rng: { next: () => seq[i++ % seq.length] }, events: [] };
}

export function expectUnchanged(s: GameState, fn: () => ActionResult, reason: Reason): void {
  const before = JSON.stringify(s);
  const r = fn();
  expect(r).toEqual({ ok: false, reason });
  expect(JSON.stringify(s)).toBe(before);
}
