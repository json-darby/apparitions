import React from 'react';

/** Outline candle in the same stroke style as the site's home icon. The flame fills when lit. */
const CandleIcon: React.FC<{ lit?: boolean; className?: string }> = ({ lit = true, className = 'w-3.5 h-3.5' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path
      d="M12 2.5c-1.6 1.9-1.9 3.6 0 5 1.9-1.4 1.6-3.1 0-5z"
      strokeWidth="1.4"
      fill={lit ? 'currentColor' : 'none'}
      opacity={lit ? 1 : 0.5}
      style={{ transition: 'opacity 600ms' }}
    />
    <path d="M12 7.5v2" />
    <path d="M8.5 9.5h7v10.5h-7z" />
    <path d="M15.5 12v2.2" />
    <path d="M6 20.5h12" />
  </svg>
);

export default CandleIcon;
