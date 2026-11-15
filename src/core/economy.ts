import type { Ctx, GameState } from './types';

/** Atomic: returns false and changes nothing if unaffordable. */
export function spend(s: GameState, amount: number): boolean {
  if (s.coins < amount) return false;
  s.coins -= amount;
  return true;
}

/** Minimal for now; level-ups arrive in Task 5. */
export function addXp(s: GameState, _ctx: Ctx, n: number): void {
  s.xp += n;
}
