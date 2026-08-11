import { describe, it, expect, beforeAll, vi } from 'vitest';
import { calculateFloatingPosition } from './floatingPosition';

// jsdom default viewport is 1024×768
const VIEWPORT_W = 1024;
const VIEWPORT_H = 768;

beforeAll(() => {
  Object.defineProperty(window, 'innerWidth', { value: VIEWPORT_W, writable: true, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: VIEWPORT_H, writable: true, configurable: true });
});

function makeAnchor(rect: Partial<DOMRect>): HTMLElement {
  const el = document.createElement('div');
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0,
    toJSON: () => ({}),
    ...rect,
  } as DOMRect);
  return el;
}

describe('calculateFloatingPosition', () => {
  describe('bottom/start — default placement', () => {
    it('places menu directly below and left-aligned with anchor', () => {
      const anchor = makeAnchor({ top: 50, bottom: 100, left: 200, right: 320, width: 120, height: 50 });
      const pos = calculateFloatingPosition(anchor, { side: 'bottom', align: 'start' });
      // top = rect.bottom + offset(4)
      expect(pos.top).toBe(104);
      // left = rect.left
      expect(pos.left).toBe(200);
    });
  });

  describe('bottom → top flip', () => {
    it('flips to top when insufficient space below', () => {
      // rect.bottom = 700 → only 68px below (768-700=68, minus offset 4 = 64) < heightEstimate(200)
      // rect.top = 600 >= heightEstimate(200) so flip is safe
      const anchor = makeAnchor({ top: 600, bottom: 700, left: 200, right: 320, width: 120, height: 100 });
      const pos = calculateFloatingPosition(anchor, { side: 'bottom', align: 'start' });
      // flipped to top → top = rect.top - heightEstimate - offset = 600 - 200 - 4 = 396
      expect(pos.top).toBe(396);
      expect(pos.left).toBe(200);
    });

    it('stays bottom when there is no space above either', () => {
      // Near top and near bottom: rect.top = 10 (< heightEstimate), rect.bottom = 740 (little below)
      const anchor = makeAnchor({ top: 10, bottom: 740, left: 200, right: 320, width: 120, height: 730 });
      const pos = calculateFloatingPosition(anchor, { side: 'bottom', align: 'start' });
      // not enough below AND not enough above → stays bottom, clamped to the viewport
      expect(pos.top).toBe(568); // viewport height(768) - menu height(200)
    });

    it('does not flip when the fallback only fits without the offset', () => {
      const anchor = makeAnchor({ top: 200, bottom: 700, left: 200, right: 320, width: 120, height: 500 });
      const pos = calculateFloatingPosition(anchor, { side: 'bottom', align: 'start' });

      expect(pos.top).toBe(568);
    });
  });

  describe('end alignment', () => {
    it('keeps end alignment when there is room to the left', () => {
      const anchor = makeAnchor({ top: 50, bottom: 100, left: 800, right: 960, width: 160, height: 50 });
      const pos = calculateFloatingPosition(anchor, { side: 'bottom', align: 'end' }, { widthEstimate: 160 });
      // left = rect.right - widthEstimate = 960 - 160 = 800
      expect(pos.left).toBe(800);
    });

    it('flips end to start when anchor is too close to the left edge', () => {
      // rect.right = 100, widthEstimate = 160 → rect.right - widthEstimate = -60 < 0 → flip to start
      const anchor = makeAnchor({ top: 50, bottom: 100, left: 0, right: 100, width: 100, height: 50 });
      const pos = calculateFloatingPosition(anchor, { side: 'bottom', align: 'end' }, { widthEstimate: 160 });
      // flipped to start → left = rect.left = 0
      expect(pos.left).toBe(0);
    });
  });

  describe('right side placement', () => {
    it('places menu to the right with start alignment', () => {
      const anchor = makeAnchor({ top: 50, bottom: 100, left: 200, right: 300, width: 100, height: 50 });
      const pos = calculateFloatingPosition(
        anchor,
        { side: 'right', align: 'start' },
        { widthEstimate: 160, heightEstimate: 200 },
      );
      // left = rect.right + offset = 304
      expect(pos.left).toBe(304);
      // top = rect.top (start alignment on horizontal side)
      expect(pos.top).toBe(50);
    });

    it('flips right to left when insufficient space on the right', () => {
      // rect.right = 900, widthEstimate=160 → window.innerWidth - 900 - 4 = 120 < 160
      // rect.left = 800 >= 160 → safe to flip
      const anchor = makeAnchor({ top: 50, bottom: 100, left: 800, right: 900, width: 100, height: 50 });
      const pos = calculateFloatingPosition(
        anchor,
        { side: 'right', align: 'start' },
        { widthEstimate: 160, heightEstimate: 200 },
      );
      // flipped to left → left = rect.left - widthEstimate - offset = 800 - 160 - 4 = 636
      expect(pos.left).toBe(636);
    });
  });

  describe('custom offset', () => {
    it('respects a custom offset option', () => {
      const anchor = makeAnchor({ top: 50, bottom: 100, left: 200, right: 320, width: 120, height: 50 });
      const pos = calculateFloatingPosition(
        anchor,
        { side: 'bottom', align: 'start' },
        { offset: 12 },
      );
      expect(pos.top).toBe(112); // 100 + 12
    });
  });

  describe('viewport clamping', () => {
    it('clamps start alignment when neither horizontal alignment fits', () => {
      const anchor = makeAnchor({ top: 50, bottom: 100, left: 900, right: 1100, width: 200, height: 50 });
      const pos = calculateFloatingPosition(
        anchor,
        { side: 'bottom', align: 'start' },
        { widthEstimate: 1200 },
      );

      expect(pos.left).toBe(0);
    });

    it('clamps a preferred primary side when neither side fits', () => {
      const anchor = makeAnchor({ top: 10, bottom: 740, left: 200, right: 320, width: 120, height: 730 });
      const pos = calculateFloatingPosition(anchor, { side: 'top', align: 'start' });

      expect(pos.top).toBe(0);
    });

    it('includes the offset when checking each fallback side', () => {
      const cases = [
        {
          rect: { top: 200, bottom: 700, left: 300, right: 400, width: 100, height: 500 },
          side: 'bottom' as const,
          expected: { top: 568, left: 300 },
        },
        {
          rect: { top: 68, bottom: 568, left: 300, right: 400, width: 100, height: 500 },
          side: 'top' as const,
          expected: { top: 0, left: 300 },
        },
        {
          rect: { top: 300, bottom: 400, left: 160, right: 900, width: 740, height: 100 },
          side: 'right' as const,
          expected: { top: 300, left: 864 },
        },
        {
          rect: { top: 300, bottom: 400, left: 124, right: 864, width: 740, height: 100 },
          side: 'left' as const,
          expected: { top: 300, left: 0 },
        },
      ];

      for (const testCase of cases) {
        const anchor = makeAnchor(testCase.rect);
        const pos = calculateFloatingPosition(anchor, { side: testCase.side, align: 'start' });

        expect(pos).toEqual(testCase.expected);
      }
    });
  });
});
