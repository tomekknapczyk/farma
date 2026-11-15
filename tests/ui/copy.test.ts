import { describe, expect, it } from 'vitest';
import { T } from '../../src/ui/copy';
import { unlocksAt } from '../../src/core/economy';

describe('copy', () => {
  it('maps reasons to Polish messages, locked with the required level', () => {
    expect(T.reason('no-money')).toBe('Za mało monet');
    expect(T.reason('locked', 3)).toBe('Od poziomu 3');
    expect(T.reason('not-ready')).toBe('Jeszcze rośnie');
    expect(T.reason('invalid')).toBe('Nie da się');
  });

  it('names every unlock key', () => {
    for (let l = 1; l <= 10; l++) for (const k of unlocksAt(l)) expect(T.unlockName(k), k).not.toBe('');
  });
});
