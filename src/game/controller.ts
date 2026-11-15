import { MAX_DT_MS } from '../core/config';
import { createRng } from '../core/rng';
import { CORRUPT_KEY, deserialize, exportFileName, loadGame, saveGame, serialize, SAVE_KEY } from '../core/save';
import { createInitialState } from '../core/state';
import { tick } from '../core/tick';
import type { ActionResult, Ctx, GameEvent, GameState } from '../core/types';

const AUTOSAVE_MS = 5000;
const NOTIFY_MS = 250;
const MAX_CHUNKS = 100;
/** The fallback download link stays valid this long (Safari reads the blob after click() returns). */
export const REVOKE_MS = 10_000;

/** 'shared' = handed to the share sheet; 'downloaded' = anchor download started; 'cancelled' = share sheet dismissed. */
export type ExportResult = 'shared' | 'downloaded' | 'cancelled' | 'failed';

export class GameController {
  state: GameState;
  ctx: Ctx;
  /** Bumped whenever the whole state is swapped (import, new game): ids are reused across states. */
  generation = 0;
  private subs = new Set<() => void>();
  private sinceSave = 0;
  private sinceNotify = 0;
  private hidden = false;
  private skipNext = false;
  private onVisibility = () => {
    if (document.visibilityState === 'hidden') {
      this.hidden = true;
      this.save();
    } else if (this.hidden) {
      this.hidden = false;
      this.skipNext = true;
    }
  };
  private onPageHide = () => { this.save(); };

  constructor(
    private store: Pick<Storage, 'getItem' | 'setItem'>,
    private opts: { speed: number; seed: number; debug: boolean },
  ) {
    // Fresh = no valid save was loaded (missing, corrupt or unreadable entry); debug bonus applies then.
    let raw: string | null = null;
    try { raw = store.getItem(SAVE_KEY); } catch { /* treated as fresh */ }
    const hadValidSave = raw !== null && deserialize(raw) !== null;
    this.state = loadGame(store, opts.seed);
    // Deterministic for a given seed (?seed=N); the caller picks a random seed when none is given.
    this.ctx = { rng: createRng(opts.seed), events: [] };
    if (opts.debug && !hadValidSave) this.state.coins += 1000;
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('pagehide', this.onPageHide);
  }

  act<A extends unknown[]>(fn: (s: GameState, ctx: Ctx, ...a: A) => ActionResult, ...a: A): ActionResult {
    const r = fn(this.state, this.ctx, ...a);
    if (r.ok) { this.save(); this.notify(); }
    return r;
  }

  step(realDtMs: number): void {
    if (this.hidden) return;
    if (this.skipNext) { this.skipNext = false; return; }
    if (!Number.isFinite(realDtMs) || realDtMs <= 0) return;
    realDtMs = Math.min(realDtMs, MAX_DT_MS);
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

  /**
   * Backup file. On touch devices where the Web Share API takes files (iPad Safari) the share sheet opens
   * ("Zapisz w Plikach"); share() is called synchronously so the tap's user activation still counts.
   * Desktop browsers (no touch) download instead: their share sheet has no plain "save". Otherwise an
   * anchor download, with the blob URL kept alive for REVOKE_MS (revoking at once breaks Safari).
   */
  async exportSave(): Promise<ExportResult> {
    const name = exportFileName(new Date());
    const json = serialize(this.state);
    try {
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      const file = typeof File === 'function' ? new File([json], name, { type: 'application/json' }) : null;
      const touch = (nav.maxTouchPoints ?? 0) > 0;
      if (file && touch && typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
        try {
          await nav.share({ files: [file], title: 'Farma' });
          return 'shared';
        } catch (e) {
          if ((e as { name?: string } | null)?.name === 'AbortError') return 'cancelled';
          // e.g. NotAllowedError: fall through to the download
        }
      }
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), REVOKE_MS);
      return 'downloaded';
    } catch {
      return 'failed';
    }
  }

  async importSave(file: File): Promise<boolean> {
    let s;
    try { s = deserialize(await file.text()); } catch { return false; }
    if (!s) return false;
    this.state = s;
    this.generation++;
    this.save();
    this.notify();
    return true;
  }

  /** Parent-menu "new game": fresh state, rng reseeded from the same seed, saved at once. */
  reset(seed: number): void {
    this.state = createInitialState(seed);
    this.ctx = { rng: createRng(seed), events: [] };
    this.generation++;
    this.save();
    this.notify();
  }

  /**
   * The loaded state passed validation but still broke the first refresh/tick: keep the raw save
   * under CORRUPT_KEY (for recovery by hand) and start a fresh game, so the game and menu still work.
   */
  recoverFromCorrupt(): void {
    let raw: string | null = null;
    try { raw = this.store.getItem(SAVE_KEY); } catch { /* unreadable */ }
    try { this.store.setItem(CORRUPT_KEY, raw ?? serialize(this.state)); } catch { /* quota */ }
    this.reset(this.opts.seed);
  }

  dispose(): void {
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('pagehide', this.onPageHide);
    this.subs.clear();
  }

  private notify(): void {
    this.sinceNotify = 0;
    for (const fn of this.subs) fn();
  }
}
