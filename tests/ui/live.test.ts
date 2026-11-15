// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLICK_WAIT_MS, live } from '../../src/ui/dom';

function setup() {
  let notify: () => void = () => {};
  let value = 'a';
  const target = document.createElement('div');
  document.body.append(target);
  const render = vi.fn((into: HTMLElement) => {
    const b = document.createElement('button');
    b.textContent = value;
    into.append(b);
  });
  const view = live((fn) => { notify = fn; return () => { notify = () => {}; }; }, () => value, target, render);
  const change = (v: string) => { value = v; notify(); };
  const button = () => target.querySelector('button') as HTMLButtonElement;
  return { target, render, view, change, button };
}

const fire = (el: EventTarget, type: string) => el.dispatchEvent(new Event(type, { bubbles: true }));

describe('live()', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); document.body.replaceChildren(); });

  it('re-renders when the key changes and skips unchanged keys', () => {
    const t = setup();
    expect(t.render).toHaveBeenCalledTimes(1);
    t.change('a');
    expect(t.render).toHaveBeenCalledTimes(1);
    t.change('b');
    expect(t.render).toHaveBeenCalledTimes(2);
    expect(t.button().textContent).toBe('b');
  });

  it('defers while pressed, keeps the node between pointerup and click, catches up after click', () => {
    const t = setup();
    const pressed = t.button();
    fire(pressed, 'pointerdown');
    t.change('b');
    expect(t.render).toHaveBeenCalledTimes(1);
    fire(window, 'pointerup');
    vi.advanceTimersByTime(50); // iOS: click arrives asynchronously after touchend
    expect(t.button()).toBe(pressed); // tapped node still in the DOM
    fire(pressed, 'click');
    expect(t.button()).toBe(pressed); // click handlers run before the catch-up
    vi.advanceTimersByTime(0);
    expect(t.render).toHaveBeenCalledTimes(2);
    expect(t.button().textContent).toBe('b');
  });

  it('falls back to a timer when no click arrives', () => {
    const t = setup();
    fire(t.button(), 'pointerdown');
    t.change('b');
    fire(window, 'pointercancel');
    vi.advanceTimersByTime(CLICK_WAIT_MS - 1);
    expect(t.render).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    vi.advanceTimersByTime(1); // fake timers bump a 0 ms timeout created inside a timer callback to 1 ms
    expect(t.render).toHaveBeenCalledTimes(2);
  });

  it('stop() removes listeners and unsubscribes', () => {
    const t = setup();
    t.view.stop();
    fire(t.button(), 'pointerdown');
    t.change('b');
    expect(t.render).toHaveBeenCalledTimes(1);
  });
});
