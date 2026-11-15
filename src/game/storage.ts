/** Save storage: localStorage when the browser allows it, else an in-memory stand-in (game still playable). */
export type Store = Pick<Storage, 'getItem' | 'setItem'>;

export function memoryStore(): Store {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => { data.set(k, String(v)); },
  };
}

/** `persistent` is false when localStorage is missing or blocked (reading `window.localStorage` can throw). */
export function openStore(get: () => Storage | null | undefined): { store: Store; persistent: boolean } {
  try {
    const ls = get();
    if (ls) {
      ls.getItem('farma.probe'); // Safari with blocked storage throws here
      return { store: ls, persistent: true };
    }
  } catch { /* fall through */ }
  return { store: memoryStore(), persistent: false };
}
