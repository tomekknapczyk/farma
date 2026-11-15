import { describe, expect, it } from 'vitest';
import { getSeasonInfo } from '../../src/core/seasons';

const MIN = 60_000;

describe('getSeasonInfo', () => {
  it('starts in spring', () => {
    const i = getSeasonInfo(0);
    expect(i.season).toBe('spring');
    expect(i.label).toBe('Wiosna');
    expect(i.inTransition).toBe(false);
  });
  it('late spring transition keeps previous season', () => {
    const i = getSeasonInfo(60 * MIN);
    expect(i.season).toBe('spring');
    expect(i.inTransition).toBe(true);
    expect(i.label).toBe('Późna wiosna');
    expect(i.next).toBe('summer');
    expect(i.transitionProgress).toBe(0);
    expect(getSeasonInfo(62.5 * MIN).transitionProgress).toBe(0.5);
  });
  it('summer at 65 min', () => {
    const i = getSeasonInfo(65 * MIN);
    expect(i.season).toBe('summer');
    expect(i.label).toBe('Lato');
    expect(i.inTransition).toBe(false);
  });
  it('thaw label and wrap-around', () => {
    expect(getSeasonInfo((3 * 65 + 60) * MIN).label).toBe('Roztopy');
    expect(getSeasonInfo(4 * 65 * MIN).season).toBe('spring');
  });
  it('other labels', () => {
    expect(getSeasonInfo((65 + 60) * MIN).label).toBe('Wczesna jesień');
    expect(getSeasonInfo((2 * 65) * MIN).label).toBe('Jesień');
    expect(getSeasonInfo((2 * 65 + 60) * MIN).label).toBe('Przedzimie');
    expect(getSeasonInfo((3 * 65) * MIN).label).toBe('Zima');
  });
});
