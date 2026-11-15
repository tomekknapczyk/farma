import { describe, expect, it } from 'vitest';
import { memoryStore, openStore } from '../../src/game/storage';

describe('openStore', () => {
  it('uses localStorage when it works', () => {
    const ls = memoryStore() as Storage;
    const r = openStore(() => ls);
    expect(r.persistent).toBe(true);
    expect(r.store).toBe(ls);
  });
  it('falls back to memory when reading window.localStorage throws', () => {
    const r = openStore(() => { throw new DOMException('denied', 'SecurityError'); });
    expect(r.persistent).toBe(false);
    r.store.setItem('k', 'v');
    expect(r.store.getItem('k')).toBe('v');
    expect(r.store.getItem('missing')).toBeNull();
  });
  it('falls back when getItem throws or storage is missing', () => {
    const broken = { getItem: () => { throw new Error('x'); }, setItem: () => {} } as unknown as Storage;
    expect(openStore(() => broken).persistent).toBe(false);
    expect(openStore(() => null).persistent).toBe(false);
  });
});
