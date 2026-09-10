import React from 'react';
import MobileNav from './MobileNav';
import { useFitText } from '../hooks/useFitText';

/** Every scene the header can link to. `null` is the landing page. */
export type Scene = string | null;

interface SiteHeaderProps {
  /** Wordmark shown on the left, e.g. "APPARITIONS: SPELEN". */
  title: string;
  /** Key of the currently active nav item, so it can be highlighted. */
  current: 'home' | 'menu' | 'core' | 'nexus' | 'help' | 'contact';
  onNavigate: (scene: Scene) => void;
  /**
   * 'fixed' floats the header over the page (landing, help, contact, games menu);
   * 'relative' lets it occupy real space in a column layout (core, nexus).
   */
  position?: 'fixed' | 'relative';
}

const CENTRE_LINKS: { key: SiteHeaderProps['current']; label: string; scene: Scene }[] = [
  { key: 'home', label: 'HOME', scene: null },
  { key: 'menu', label: 'GAMES', scene: 'menu' },
  { key: 'core', label: 'CORE', scene: 'core' },
  { key: 'nexus', label: 'NEXUS', scene: 'nexus' },
  { key: 'help', label: 'HELP', scene: 'help' },
];

/** Never shrink the wordmark past this, no matter how narrow the device. */
const MIN_TITLE_PX = 12;

/**
 * The single site-wide header. Previously this markup was copy-pasted into six
 * different scenes, which is why the wordmark/menu spacing only ever got fixed
 * in some of them.
 */
const SiteHeader: React.FC<SiteHeaderProps> = ({ title, current, onNavigate, position = 'fixed' }) => {
  const { boxRef, textRef } = useFitText<HTMLDivElement, HTMLSpanElement>(title, MIN_TITLE_PX);

  return (
    <nav
      className={`${position} top-0 left-0 w-full h-[65px] md:h-[100px] z-[100] px-4 md:px-12 flex items-center justify-between gap-3 md:gap-6 pointer-events-none mix-blend-difference shrink-0`}
    >
      {/* Wordmark — takes the leftover width and scales its text down to fit it. */}
      <div ref={boxRef} className="flex-1 min-w-0 overflow-hidden pointer-events-auto">
        <span
          ref={textRef}
          className="font-display font-bold text-xl md:text-2xl tracking-tighter text-white whitespace-nowrap inline-block align-middle"
        >
          {title}
        </span>
      </div>

      {/* Centre links (desktop only) */}
      <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-[40px] text-xs font-bold tracking-[0.2em] pointer-events-auto">
        {CENTRE_LINKS.map(link => (
          <button
            key={link.key}
            onClick={() => (link.key === current ? undefined : onNavigate(link.scene))}
            className={`transition-colors duration-300 tracking-[0.2em] focus:outline-none ${
              link.key === current
                ? 'text-white font-bold drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] cursor-default'
                : 'text-[#555] hover:text-white'
            }`}
          >
            {link.label}
          </button>
        ))}
      </div>

      {/* Mobile menu + contact */}
      <div className="pointer-events-auto flex items-center gap-3 shrink-0">
        <MobileNav current={current} title={title} onNavigate={onNavigate} />
        <button
          onClick={() => (current === 'contact' ? undefined : onNavigate('contact'))}
          className={`hidden sm:inline-block px-6 py-2 border rounded-full text-xs font-bold uppercase tracking-wider transition-colors duration-500 ${
            current === 'contact'
              ? 'border-white bg-white text-black cursor-default'
              : 'border-white/20 text-white hover:bg-white hover:text-black'
          }`}
        >
          Contact
        </button>
      </div>
    </nav>
  );
};

export default SiteHeader;
