import React, { useEffect } from 'react';

/**
 * The one way the app tells the user something went wrong.
 *
 * Deliberately monochrome: the site is black, white and grey, so errors are set
 * apart by shape (a hollow diamond and a thin rule) and the monospace "system"
 * type rather than by alarm red. Every message should be plain English and say
 * what the user can do next.
 *
 *  - `floating`: a dismissible card pinned to the top of the nearest positioned
 *    ancestor, for errors that interrupt an action (connection, microphone).
 *  - default: an inline block that sits where the missing content would have
 *    been (a lesson that failed to load, an empty archive entry).
 */

interface NoticeProps {
  /** Short heading in the small caps style. */
  title?: string;
  message: React.ReactNode;
  /** Shows a CLOSE control when provided. */
  onDismiss?: () => void;
  /** Dismiss on its own after this many milliseconds (needs onDismiss). */
  autoHideMs?: number;
  floating?: boolean;
  className?: string;
}

/** Inline status words (e.g. in a HUD row) that report a fault. */
export const NOTICE_TEXT_CLASS = 'text-white/45';

export const NoticeMark: React.FC = () => (
  <span aria-hidden className="inline-block w-1.5 h-1.5 rotate-45 border border-white/60 shrink-0" />
);

const Notice: React.FC<NoticeProps> = ({
  title = 'Interference',
  message,
  onDismiss,
  autoHideMs,
  floating = false,
  className = '',
}) => {
  useEffect(() => {
    if (!autoHideMs || !onDismiss) return;
    const timer = window.setTimeout(onDismiss, autoHideMs);
    return () => window.clearTimeout(timer);
  }, [autoHideMs, onDismiss, message]);

  const placement = floating
    ? 'absolute top-4 md:top-8 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-2rem)] max-w-md shadow-2xl animate-in fade-in slide-in-from-top-4 duration-500'
    : 'w-full max-w-md';

  return (
    <div
      role={floating ? 'alert' : 'status'}
      className={`${placement} bg-black/85 backdrop-blur-xl border border-white/10 border-l-white/40 font-mono ${className}`}
    >
      <div className="flex items-center gap-3 px-4 pt-3 md:px-5">
        <NoticeMark />
        <span className="flex-1 min-w-0 text-[9px] uppercase tracking-[0.3em] text-white/50 truncate">{title}</span>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="shrink-0 text-[9px] uppercase tracking-[0.25em] text-white/40 hover:text-white transition-colors"
          >
            Close
          </button>
        )}
      </div>
      <p className="px-4 pb-3 pt-2 md:px-5 md:pb-4 text-[10px] md:text-[11px] leading-relaxed tracking-[0.12em] uppercase text-gray-300 break-words">
        {message}
      </p>
    </div>
  );
};

export default Notice;
