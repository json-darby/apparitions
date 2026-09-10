import { useLayoutEffect, useRef } from 'react';

/**
 * Shrinks a single line of text so it always fits the width of its container.
 *
 * Attach `boxRef` to the element that defines the available width and `textRef`
 * to the (nowrap) text inside it. The text keeps the font size its CSS class
 * gives it until that would overflow, then scales down, never below `minPx`.
 *
 * The size is written directly to the node instead of being held in state: a
 * measurement that depends on a re-render is how you get a layout feedback loop.
 */
export function useFitText<
  Box extends HTMLElement = HTMLDivElement,
  Text extends HTMLElement = HTMLSpanElement
>(text: string, minPx = 8) {
  const boxRef = useRef<Box>(null);
  const textRef = useRef<Text>(null);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const node = textRef.current;
    if (!box || !node) return;

    const fit = () => {
      /* Clear the override first so the CSS class supplies the ideal size again. */
      node.style.fontSize = '';
      const ideal = parseFloat(window.getComputedStyle(node).fontSize) || minPx;
      const available = box.clientWidth;
      const natural = node.scrollWidth;
      if (available > 0 && natural > available) {
        node.style.fontSize = `${Math.max(minPx, Math.floor((ideal * available) / natural))}px`;
      }
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    /* Web fonts land after first paint and change the natural width. */
    (document as any).fonts?.ready?.then(fit).catch(() => { /* no font loading API */ });
    return () => observer.disconnect();
  }, [text, minPx]);

  return { boxRef, textRef };
}

interface FitBlockOptions {
  /** Largest size to use when the text is short enough. */
  maxPx?: number;
  /** Never shrink below this, however long the text is. */
  minPx?: number;
  /** How many wrapped lines the text is allowed to occupy. */
  maxLines?: number;
  /** Must match the CSS line-height applied to the text. */
  lineHeight?: number;
}

/**
 * Sizes a heading that is allowed to WRAP, shrinking it until it fits its
 * container's width within `maxLines` lines.
 *
 * The single-line `useFitText` cannot do this job: a long title squeezed onto one
 * line ends up unreadably small. Sizing from the measured box also replaces
 * guessing from character count, which ignores both the font and the real width
 * available — the reason long names used to spill out of the panel on a phone.
 */
export function useFitBlock<
  Box extends HTMLElement = HTMLDivElement,
  Text extends HTMLElement = HTMLHeadingElement
>(text: string, { maxPx = 48, minPx = 14, maxLines = 3, lineHeight = 0.95 }: FitBlockOptions = {}) {
  const boxRef = useRef<Box>(null);
  const textRef = useRef<Text>(null);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const node = textRef.current;
    if (!box || !node) return;

    const fit = () => {
      const available = box.clientWidth;
      if (available <= 0) return;

      for (let size = maxPx; size >= minPx; size--) {
        node.style.fontSize = `${size}px`;
        const fitsWidth = node.scrollWidth <= available + 1;
        const fitsHeight = node.scrollHeight <= size * lineHeight * maxLines + 1;
        if (fitsWidth && fitsHeight) break;
      }
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    (document as any).fonts?.ready?.then(fit).catch(() => { /* no font loading API */ });
    return () => observer.disconnect();
  }, [text, maxPx, minPx, maxLines, lineHeight]);

  return { boxRef, textRef };
}
