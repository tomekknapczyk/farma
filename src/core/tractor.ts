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

/** Works the row (x+i, y), i = 0..rowLength-1, stopping at the first tile without a field. Ready fields are
 * harvested, growing unwatered ones watered, others skipped. n = fields acted on; 0 -> 'invalid'. */
export function useTractor(s: GameState, ctx: Ctx, x: number, y: number): ActionResult {
  if (!s.hasTractor) return { ok: false, reason: 'locked' };
  let n = 0;
  for (let i = 0; i < TRACTOR.rowLength; i++) {
    const occ = tileOccupant(s, x + i, y);
    if (!occ || occ.kind !== 'field') break;
    const f = occ.field;
    if (isReady(f)) {
      if (harvest(s, ctx, f.id).ok) n++;
    } else if (f.crop !== null && !f.watered) {
      if (water(s, ctx, f.id).ok) n++;
    }
  }
  return n === 0 ? { ok: false, reason: 'invalid' } : { ok: true, n };
}
