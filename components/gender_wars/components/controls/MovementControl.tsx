import React from 'react';
import DPad from './DPad';
import AnalogStick from './AnalogStick';
import { ControlScheme, Direction } from './types';

interface MovementControlProps {
  scheme: ControlScheme;
  onDirection: (dir: Direction, pressed: boolean) => void;
  onAxis: (x: number, y: number) => void;
  sizeClass?: string;
  variant?: 'deck' | 'floating';
}

/** Renders whichever movement control the player has selected. */
const MovementControl: React.FC<MovementControlProps> = ({
  scheme, onDirection, onAxis, sizeClass, variant,
}) =>
  scheme === 'stick'
    ? <AnalogStick onAxis={onAxis} sizeClass={sizeClass} variant={variant} />
    : <DPad onDirection={onDirection} sizeClass={sizeClass} variant={variant} />;

interface SchemeToggleProps {
  scheme: ControlScheme;
  onChange: (scheme: ControlScheme) => void;
  className?: string;
}

const OPTIONS: { value: ControlScheme; label: string }[] = [
  { value: 'dpad', label: 'PAD' },
  { value: 'stick', label: 'STICK' },
];

/** Compact segmented switch for swapping between the cross pad and the thumbstick. */
export const SchemeToggle: React.FC<SchemeToggleProps> = ({ scheme, onChange, className = '' }) => (
  <div className={`flex items-stretch border border-white/20 divide-x divide-white/15 bg-black/60 backdrop-blur-sm ${className}`}>
    {OPTIONS.map(option => (
      <button
        key={option.value}
        onClick={() => onChange(option.value)}
        aria-pressed={scheme === option.value}
        className={`px-2 py-1 text-[7px] font-mono font-bold tracking-[0.15em] uppercase transition-colors ${
          scheme === option.value ? 'bg-white text-black' : 'text-gray-400 hover:text-white'
        }`}
      >
        {option.label}
      </button>
    ))}
  </div>
);

export default MovementControl;
