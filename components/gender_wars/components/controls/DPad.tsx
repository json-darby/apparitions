import React from 'react';
import { Direction } from './types';

interface DPadProps {
  onDirection: (dir: Direction, pressed: boolean) => void;
  /** Tailwind size classes for the whole pad, e.g. "w-32 h-32". */
  sizeClass?: string;
  /** 'deck' sits inside the portrait console; 'floating' overlays the landscape canvas. */
  variant?: 'deck' | 'floating';
}

const ARROWS: { dir: Direction; glyph: string; cell: string; label: string }[] = [
  { dir: 'up', glyph: '▲', cell: 'col-start-2 row-start-1', label: 'Up' },
  { dir: 'left', glyph: '◄', cell: 'col-start-1 row-start-2', label: 'Left' },
  { dir: 'right', glyph: '►', cell: 'col-start-3 row-start-2', label: 'Right' },
  { dir: 'down', glyph: '▼', cell: 'col-start-2 row-start-3', label: 'Down' },
];

/**
 * Four-way cross pad. Each arrow simply latches a direction on press and releases
 * it on lift, cancel, or pointer-out, so a finger sliding off a key can't leave the
 * ship flying in that direction forever.
 */
const DPad: React.FC<DPadProps> = ({ onDirection, sizeClass = 'w-32 h-32', variant = 'deck' }) => {
  const shell =
    variant === 'floating'
      ? 'bg-[#09090b]/80 backdrop-blur-md border-white/15'
      : 'bg-[#0c0c10] border-white/15';

  return (
    <div className={`grid grid-cols-3 grid-rows-3 gap-1 ${sizeClass} ${shell} p-1 border shadow-xl shrink-0`}>
      {ARROWS.map(({ dir, glyph, cell, label }) => (
        <button
          key={dir}
          onTouchStart={(e) => { e.preventDefault(); onDirection(dir, true); }}
          onTouchEnd={(e) => { e.preventDefault(); onDirection(dir, false); }}
          onTouchCancel={() => onDirection(dir, false)}
          onMouseDown={() => onDirection(dir, true)}
          onMouseUp={() => onDirection(dir, false)}
          onMouseLeave={() => onDirection(dir, false)}
          className={`${cell} bg-[#18181c] active:bg-white active:text-black border border-white/20 text-white flex items-center justify-center text-sm font-mono font-bold shadow active:scale-95 transition-all touch-none`}
          aria-label={label}
        >
          {glyph}
        </button>
      ))}
    </div>
  );
};

export default DPad;
