// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

// shop.ts pulls in a module that imports Phaser at runtime; the sell tab never uses it
vi.mock('phaser', () => ({ default: { Scene: class {} } }));
import { GameController } from '../../src/game/controller';
import type { FarmScene } from '../../src/game/FarmScene';
import { closeModal } from '../../src/ui/dom';
import { clampQty, openShop } from '../../src/ui/shop';

describe('clampQty', () => {
  it('parses digits, clamps to 0..max, empty -> 0', () => {
    expect(clampQty('', 10)).toBe(0);
    expect(clampQty('7', 10)).toBe(7);
    expect(clampQty('25', 10)).toBe(10);
    expect(clampQty('-3', 10)).toBe(3); // non-digits are dropped
    expect(clampQty('1a2', 50)).toBe(12);
    expect(clampQty(-4, 10)).toBe(0);
    expect(clampQty(11, 10)).toBe(10);
    expect(clampQty('5', 0)).toBe(0);
  });
});

function setup() {
  const store = { getItem: vi.fn(() => null), setItem: vi.fn() };
  const c = new GameController(store, { speed: 1, seed: 1, debug: false });
  c.state.storage.wheat = 30;
  c.state.storage.egg = 2;
  openShop(c, {} as FarmScene, 'sell');
  const notify = () => (c as unknown as { notify(): void }).notify();
  const input = () => document.querySelector('.sell-row input') as HTMLInputElement;
  return { c, notify, input };
}

describe('sell quantity picker', () => {
  afterEach(() => { closeModal(); document.body.replaceChildren(); });

  it('typed amount survives a re-render while focused and is what gets sold', async () => {
    const { c, notify, input } = setup();
    const field = input();
    field.focus();
    field.value = '25';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    c.state.storage.egg = 3; // key changes -> re-render requested
    notify();
    expect(input()).toBe(field);
    expect(field.value).toBe('25');
    const sellBtn = document.querySelector('.sell-row .btn.sell-go') as HTMLButtonElement;
    expect(sellBtn.textContent).toContain('25');
    expect(sellBtn.textContent).toContain('100');
    const coins = c.state.coins;
    sellBtn.click();
    expect(c.state.storage.wheat).toBe(5);
    expect(c.state.coins).toBe(coins + 100);
    await new Promise((r) => setTimeout(r, 0));
    expect(input().value).toBe('0');
    c.dispose();
  });

  it('clamps typing above the stock, buttons step and stop at bounds, Wszystko fills the max', () => {
    const { c, input } = setup();
    const row = document.querySelector('.sell-row') as HTMLElement;
    const b = (cls: string) => row.querySelector(`.btn.${cls}`) as HTMLButtonElement;
    expect(b('sell-go').classList.contains('disabled')).toBe(true);
    expect(b('q-minus').classList.contains('disabled')).toBe(true);
    input().value = '99';
    input().dispatchEvent(new Event('input', { bubbles: true }));
    expect(input().value).toBe('30');
    expect(b('q-plus1').classList.contains('disabled')).toBe(true);
    b('q-minus').click();
    expect(input().value).toBe('29');
    b('q-plus10').click();
    expect(input().value).toBe('30');
    input().value = '';
    input().dispatchEvent(new Event('input', { bubbles: true }));
    input().dispatchEvent(new Event('blur'));
    expect(input().value).toBe('0');
    b('q-all').click();
    expect(input().value).toBe('30');
    c.dispose();
  });
});
