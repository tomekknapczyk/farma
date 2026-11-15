import { TRACTOR, XP } from './config';
import { addXp, isUnlocked, spend } from './economy';
import { harvest, isReady, water } from './crops';
import { tileOccupant } from './map';
import type { ActionResult, Ctx, GameState } from './types';

export function buyTractor(s: GameState, ctx: Ctx): ActionResult {
  if (s.hasTractor) return { ok: false, reason: 'invalid' };
  if (!isUnlocked(s, 'tractor')) return { ok: false, reason: 'locked' };
  if (!spend(s, TRACTOR.cost)) return { ok: false, reason: 'no-money' };
  s.hasTractor = true;
  addXp(s, ctx, XP.buy);
  return { ok: true };
}

const isField = (s: GameState, x: number, y: number): boolean => tileOccupant(s, x, y)?.kind === 'field';

/**
 * Works up to TRACTOR.rowLength fields of the contiguous run of field tiles on row y that contains
 * the tapped tile (x, y). When the run is longer, the window includes the tapped tile and extends
 * right first, then left (so a tap near the right end still works rowLength fields). Ready fields are
 * harvested, growing unwatered ones watered, others skipped. n = fields acted on; 0 or a tap on a
 * tile without a field -> 'invalid'.
 */
export function useTractor(s: GameState, ctx: Ctx, x: number, y: number): ActionResult {
  if (!s.hasTractor) return { ok: false, reason: 'locked' };
  if (!isField(s, x, y)) return { ok: false, reason: 'invalid' };
  const len = TRACTOR.rowLength;
  let end = x;
  while (end - x + 1 < len && isField(s, end + 1, y)) end++;
  let start = x;
  while (end - start + 1 < len && isField(s, start - 1, y)) start--;
  let n = 0;
  for (let i = start; i <= end; i++) {
    const occ = tileOccupant(s, i, y);
    if (occ?.kind !== 'field') continue;
    const f = occ.field;
    if (isReady(f)) {
      if (harvest(s, ctx, f.id).ok) n++;
    } else if (f.crop !== null && !f.watered) {
      if (water(s, ctx, f.id).ok) n++;
    }
  }
  return n === 0 ? { ok: false, reason: 'invalid' } : { ok: true, n };
}
