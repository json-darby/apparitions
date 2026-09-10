import React, { useState } from 'react';
import { createPortal } from 'react-dom';

interface MobileNavProps {
  current?: string;
  /** Must match the real nav's title text exactly so the header overlaps it. */
  title?: string;
  onNavigate: (scene: string | null) => void;
}

const NAV_ITEMS: { key: string; label: string; scene: string | null }[] = [
  { key: 'home', label: 'HOME', scene: null },
  { key: 'menu', label: 'GAMES', scene: 'menu' },
  { key: 'core', label: 'CORE', scene: 'core' },
  { key: 'nexus', label: 'NEXUS', scene: 'nexus' },
  { key: 'help', label: 'HELP', scene: 'help' },
  { key: 'contact', label: 'CONTACT', scene: 'contact' },
];

const TOGGLE_BUTTON_CLASSES = "px-3 py-1.5 border border-white/30 text-white text-[10px] font-mono tracking-widest uppercase hover:bg-white hover:text-black transition-colors";

const MobileNav: React.FC<MobileNavProps> = ({ current, title = 'APPARITIONS', onNavigate }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(prev => !prev)}
        className={`md:hidden ${TOGGLE_BUTTON_CLASSES}`}
      >
        ☰ MENU
      </button>

      {current !== 'home' && (
        <button
          onClick={() => onNavigate(null)}
          aria-label="Home"
          className={`md:hidden ${TOGGLE_BUTTON_CLASSES} !px-2.5 flex items-center justify-center`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 11.5 12 4l9 7.5" />
            <path d="M5.5 10v9.5h13V10" />
          </svg>
        </button>
      )}

      {open && createPortal(
        <div className="md:hidden fixed inset-0 z-[200] bg-black flex flex-col animate-in fade-in duration-200">
          {/* Header row — exact geometry/typography of the real nav, with RETURN sitting where MENU was */}
          <div className="w-full h-[65px] px-4 flex items-center justify-between gap-3 shrink-0">
            <h3 className="font-display font-bold text-xl tracking-tighter text-white min-w-0 truncate">{title}</h3>
            <button onClick={() => setOpen(false)} className={`${TOGGLE_BUTTON_CLASSES} shrink-0`}>
              RETURN
            </button>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center gap-8 font-mono text-base tracking-[0.25em] overflow-y-auto">
            {NAV_ITEMS.map(item => (
              <button
                key={item.key}
                onClick={() => { onNavigate(item.scene); setOpen(false); }}
                className={`text-center py-3 px-8 transition-colors focus:outline-none ${current === item.key ? 'text-white font-bold' : 'text-gray-400 hover:text-white'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default MobileNav;
