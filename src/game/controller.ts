import { MAX_DT_MS } from '../core/config';
import { createRng } from '../core/rng';
import { deserialize, exportFileName, loadGame, saveGame, SAVE_KEY } from '../core/save';
import { tick } from '../core/tick';
import type { ActionResult, Ctx, GameEvent, GameState } from '../core/types';

const AUTOSAVE_MS = 5000;
const NOTIFY_MS = 250;
const MAX_CHUNKS = 100;

export class GameController {
  state: GameState;
  ctx: Ctx;
  private subs = new Set<() => void>();
  private sinceSave = 0;
  private sinceNotify = 0;
  private onVisibility = () => { if (document.visibilityState === 'hidden') this.save(); };

  constructor(
    private store: Pick<Storage, 'getItem' | 'setItem'>,
    private opts: { speed: number; seed: number; debug: boolean },
  ) {
    // A fresh game is detected by the absence of a save entry (a corrupt one also yields a fresh state,
    // and is then treated as fresh too, which is fine for debug bonus coins).
    const hadSave = store.getItem(SAVE_KEY) !== null;
    this.state = loadGame(store, opts.seed);
    this.ctx = { rng: createRng(opts.seed ^ Date.now()), events: [] };
    if (opts.debug && !hadSave) this.state.coins += 1000;
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  act<A extends unknown[]>(fn: (s: GameState, ctx: Ctx, ...a: A) => ActionResult, ...a: A): ActionResult {
    const r = fn(this.state, this.ctx, ...a);
    if (r.ok) { this.save(); this.notify(); }
    return r;
  }

  step(realDtMs: number): void {
    let left = realDtMs * this.opts.speed;
    for (let i = 0; i < MAX_CHUNKS && left > 0; i++) {
      const dt = Math.min(left, MAX_DT_MS);
      tick(this.state, this.ctx, dt);
      left -= dt;
    }
    this.sinceSave += realDtMs;
    this.sinceNotify += realDtMs;
    if (this.sinceSave >= AUTOSAVE_MS) this.save();
    if (this.ctx.events.length > 0 || this.sinceNotify >= NOTIFY_MS) this.notify();
  }

  drainEvents(): GameEvent[] {
    const e = this.ctx.events;
    this.ctx.events = [];
    return e;
  }

  subscribe(fn: () => void): () => void {
    this.subs.add(fn);
    return () => { this.subs.delete(fn); };
  }

  save(): void {
    this.sinceSave = 0;
    saveGame(this.store, this.state);
  }

  exportSave(): void {
    const blob = new Blob([JSON.stringify(this.state)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = exportFileName(new Date());
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async importSave(file: File): Promise<boolean> {
    const s = deserialize(await file.text());
    if (!s) return false;
    this.state = s;
    this.save();
    this.notify();
    return true;
  }

  dispose(): void {
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.subs.clear();
  }

  private notify(): void {
    this.sinceNotify = 0;
    for (const fn of this.subs) fn();
  }
}
