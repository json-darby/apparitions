import React, { useEffect, useRef, useState } from 'react';

interface MobileAlertBarProps {
  agency?: string;
  text: string;
  color?: number[];
}

/* Total on-screen lifetime matches the desktop card's visible duration
   (entrance -> hold/scroll -> fade), so mobile and desktop feel equally paced. */
const TOTAL_VISIBLE_MS = 15000;
const ENTER_MS = 450;
const START_PAUSE_MS = 1100;
const END_PAUSE_MS = 900;
const EXIT_MS = 700;
/* Scroll speed is paced for comfortable reading, not stretched to fill the
   full timeframe — after it finishes, the tail of the message simply rests
   on screen for whatever time remains before the fade. */
const SCROLL_PX_PER_SECOND = 55;
const MIN_SCROLL_MS = 1200;
/* Grace window after the finger lifts before the auto-scroll resumes, so a
   momentum-scroll settling doesn't get yanked mid-glide. */
const RESUME_DELAY_MS = 250;

/**
 * Bottom-attached mobile notification bar. Slides up flush with the screen
 * edge; short messages hold in place and fade out, long messages pause
 * briefly, scroll smoothly across, rest a moment, then fade out. Total
 * visible time is fixed so every alert lasts as long as the desktop one.
 *
 * The message track is a genuine (scrollbar-hidden) scroll container: holding
 * a finger on it freezes the auto-scroll and the fade-out countdown, and
 * dragging scrubs back and forth through the text, exactly like the bar
 * isn't animating at all until touched.
 */
const MobileAlertBar: React.FC<MobileAlertBarProps> = ({ agency, text, color }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [entered, setEntered] = useState(false);
  const [exiting, setExiting] = useState(false);

  const accent = color && color.length >= 3 ? `rgba(${color[0]}, ${color[1]}, ${color[2]}, 1)` : '#fff';

  // Refs drive the rAF timeline directly so a hold-to-pause gesture can
  // freeze and resume it without fighting React's render cycle.
  const overflowRef = useRef(0);
  const scrollDurationRef = useRef(MIN_SCROLL_MS);
  const elapsedRef = useRef(0);
  const lastFrameRef = useRef<number | null>(null);
  const pausedRef = useRef(false);
  const heldRef = useRef(false);
  const resumeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!entered) return;
    let rafId: number;

    const measureTimer = window.setTimeout(() => {
      const diff = textRef.current && trackRef.current
        ? textRef.current.scrollWidth - trackRef.current.clientWidth
        : 0;
      overflowRef.current = diff > 0 ? diff : 0;

      if (overflowRef.current > 0) {
        const scrollStartAt = ENTER_MS + START_PAUSE_MS;
        const exitAt = TOTAL_VISIBLE_MS - EXIT_MS;
        const naturalPace = Math.max(MIN_SCROLL_MS, (overflowRef.current / SCROLL_PX_PER_SECOND) * 1000);
        const availableBudget = Math.max(MIN_SCROLL_MS, exitAt - END_PAUSE_MS - scrollStartAt);
        scrollDurationRef.current = Math.min(naturalPace, availableBudget);
      }

      lastFrameRef.current = performance.now();
      rafId = requestAnimationFrame(tick);
    }, 20);

    function tick(now: number) {
      const last = lastFrameRef.current ?? now;
      const dt = now - last;
      lastFrameRef.current = now;

      if (!pausedRef.current) {
        elapsedRef.current += dt;

        const t = elapsedRef.current;
        const scrollStartAt = ENTER_MS + START_PAUSE_MS;
        const scrollEndAt = scrollStartAt + scrollDurationRef.current;
        const exitAt = TOTAL_VISIBLE_MS - EXIT_MS;

        if (trackRef.current && overflowRef.current > 0) {
          let target: number;
          if (t < scrollStartAt) target = 0;
          else if (t < scrollEndAt) target = overflowRef.current * ((t - scrollStartAt) / scrollDurationRef.current);
          else target = overflowRef.current;
          trackRef.current.scrollLeft = target;
        }

        if (t >= exitAt) {
          setExiting(true);
          return;
        }
      }

      rafId = requestAnimationFrame(tick);
    }

    return () => {
      clearTimeout(measureTimer);
      cancelAnimationFrame(rafId);
    };
  }, [entered]);

  /* Sync the timeline clock to wherever the user left the scroll position,
     so resuming continues forward from there instead of jumping. */
  const syncElapsedToScrollPosition = () => {
    if (!trackRef.current || overflowRef.current <= 0) return;
    const scrollStartAt = ENTER_MS + START_PAUSE_MS;
    const progress = Math.min(1, Math.max(0, trackRef.current.scrollLeft / overflowRef.current));
    elapsedRef.current = scrollStartAt + progress * scrollDurationRef.current;
  };

  const handleHoldStart = () => {
    heldRef.current = true;
    pausedRef.current = true;
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
  };

  const handleHoldEnd = () => {
    heldRef.current = false;
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = window.setTimeout(() => {
      syncElapsedToScrollPosition();
      lastFrameRef.current = performance.now();
      pausedRef.current = false;
    }, RESUME_DELAY_MS);
  };

  return (
    <div className="md:hidden fixed inset-x-0 bottom-0 z-[150] pointer-events-none">
      <style>{`.apparitions-alert-track::-webkit-scrollbar { display: none; }`}</style>
      <div
        className="pointer-events-auto bg-[#050505]/97 backdrop-blur-md border-t px-4 pt-2.5 flex items-center gap-3.5 overflow-hidden"
        style={{
          borderTopColor: accent,
          borderTopWidth: '3px',
          paddingBottom: 'calc(0.625rem + env(safe-area-inset-bottom, 0px))',
          transform: entered ? 'translateY(0)' : 'translateY(100%)',
          opacity: exiting ? 0 : 1,
          transition: exiting
            ? `opacity ${EXIT_MS}ms ease-in`
            : `transform ${ENTER_MS}ms cubic-bezier(0.16,1,0.3,1)`
        }}
      >
        <span className="relative top-px text-[8px] uppercase font-bold tracking-[0.2em] leading-none shrink-0" style={{ color: accent }}>
          {agency || 'SYSTEM'}
        </span>
        <div
          ref={trackRef}
          className="apparitions-alert-track relative -top-px overflow-x-auto whitespace-nowrap flex-1 min-w-0 leading-none"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          onPointerDown={handleHoldStart}
          onPointerUp={handleHoldEnd}
          onPointerCancel={handleHoldEnd}
          onPointerLeave={() => { if (heldRef.current) handleHoldEnd(); }}
        >
          <span
            ref={textRef}
            className="inline-block text-[11px] text-white/90 font-mono leading-none"
          >
            {text}
          </span>
        </div>
      </div>
    </div>
  );
};

export default MobileAlertBar;
