// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../../src/core/state';
import type { GameController } from '../../src/game/controller';
import { mountHud } from '../../src/ui/hud';

function fakeController() {
  const state = createInitialState(1);
  let fn: () => void = () => {};
  const c = { state, subscribe: (f: () => void) => { fn = f; return () => {}; } } as unknown as GameController;
  return { c, state, notify: () => fn() };
}

describe('HUD storage bar', () => {
  it('shows all six items, dims zeros, bumps on increase without rebuilding, opens shop on tap', () => {
    const { c, state, notify } = fakeController();
    const root = document.createElement('div');
    const onTap = vi.fn();
    mountHud(root, c, onTap);
    const bar = root.querySelector('.pill.storage') as HTMLButtonElement;
    const items = () => [...bar.querySelectorAll('.store-item')];
    expect(items()).toHaveLength(6);
    expect(items().map((i) => i.textContent)).toEqual(['0', '0', '0', '0', '0', '0']);
    expect(items().every((i) => i.classList.contains('zero'))).toBe(true);
    expect(items().some((i) => i.classList.contains('bump'))).toBe(false);

    const first = items()[0];
    state.storage.wheat = 3;
    notify();
    expect(items()[0]).toBe(first); // same node: tap-safe
    expect(first.textContent).toBe('3');
    expect(first.classList.contains('zero')).toBe(false);
    expect(first.classList.contains('bump')).toBe(true);
    expect(items()[1].classList.contains('bump')).toBe(false);

    bar.click();
    expect(onTap).toHaveBeenCalledTimes(1);
  });
});

describe('HUD XP bar', () => {
  it('fills with a two-decimal width and updates when a gain crosses a 0.5% step', () => {
    const { c, state, notify } = fakeController();
    const root = document.createElement('div');
    mountHud(root, c, () => {});
    const fill = root.querySelector('.xp-fill') as HTMLElement;
    state.xp = 18; // 18 / 150 = 12%
    notify();
    expect(fill.style.width).toBe('12.00%');
    state.xp = 19; // 12.666...% -> key 12.5, a new step, so it re-renders
    notify();
    expect(fill.style.width).toBe('12.67%');
  });
});
