import { describe, it, expect } from 'vitest';
import { createRng } from '../../src/core/rng';

describe('createRng', () => {
  it('same seed gives same 5-number sequence in [0,1)', () => {
    const a = createRng(42);
    const b = createRng(42);
    const sa = Array.from({ length: 5 }, () => a.next());
    const sb = Array.from({ length: 5 }, () => b.next());
    expect(sa).toEqual(sb);
    for (const n of sa) {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });
  it('different seeds differ', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });
});
