/**
 * Views of state objects (crops, buildings, animals, ...) keyed by object id. Ids are only unique
 * within one game state (every new game starts again at f1, b2, ...), so when the controller swaps
 * the whole state (backup import, new game) its `generation` changes and every cached view must be
 * destroyed: a view keeps the position/kind it was created with.
 */
export class ViewCache<V> {
  private map = new Map<string, V>();
  private generation: number | null = null;

  constructor(private destroyView: (v: V) => void) {}

  /** Destroys every view when `generation` differs from the last one seen. Returns true if it did. */
  sync(generation: number): boolean {
    if (generation === this.generation) return false;
    const first = this.generation === null;
    this.generation = generation;
    this.clear();
    return !first;
  }

  get(id: string): V | undefined { return this.map.get(id); }
  set(id: string, v: V): void { this.map.set(id, v); }
  values(): IterableIterator<V> { return this.map.values(); }
  entries(): IterableIterator<[string, V]> { return this.map.entries(); }
  [Symbol.iterator](): IterableIterator<[string, V]> { return this.map.entries(); }

  /** Destroys the views whose id is not in `keep`. */
  prune(keep: Set<string>): void {
    for (const [id, v] of this.map) if (!keep.has(id)) { this.destroyView(v); this.map.delete(id); }
  }

  clear(): void {
    for (const v of this.map.values()) this.destroyView(v);
    this.map.clear();
  }
}
