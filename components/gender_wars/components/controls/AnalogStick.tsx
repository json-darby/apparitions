import React, { useCallback, useRef, useState } from 'react';

interface AnalogStickProps {
  /** Receives a normalised vector, each axis in -1..1. (0,0) means released. */
  onAxis: (x: number, y: number) => void;
  /** Tailwind size classes for the base, e.g. "w-32 h-32". */
  sizeClass?: string;
  /** 'deck' sits inside the portrait console; 'floating' overlays the landscape canvas. */
  variant?: 'deck' | 'floating';
}

/** Movement below this fraction of the radius is ignored, so a resting thumb doesn't drift. */
const DEAD_ZONE = 0.16;

/**
 * Touch thumbstick. The knob follows the finger up to the edge of the base and
 * springs back to centre on release; the reported vector is proportional to how
 * far it is pushed, so the ship can be nudged as well as thrown.
 */
const AnalogStick: React.FC<AnalogStickProps> = ({ onAxis, sizeClass = 'w-32 h-32', variant = 'deck' }) => {
  const baseRef = useRef<HTMLDivElement>(null);
  const pointerIdRef = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const shell =
    variant === 'floating'
      ? 'bg-[#09090b]/80 backdrop-blur-md border-white/15'
      : 'bg-[#0c0c10] border-white/15';

  const release = useCallback(() => {
    pointerIdRef.current = null;
    setKnob({ x: 0, y: 0 });
    onAxis(0, 0);
  }, [onAxis]);

  const track = useCallback((clientX: number, clientY: number) => {
    const base = baseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const radius = rect.width / 2;
    if (radius <= 0) return;

    const dx = (clientX - (rect.left + radius)) / radius;
    const dy = (clientY - (rect.top + rect.height / 2)) / radius;

    /* Clamp the vector to the unit circle rather than the square, so diagonals
       aren't faster than the cardinal directions. */
    const magnitude = Math.hypot(dx, dy);
    const scale = magnitude > 1 ? 1 / magnitude : 1;
    const nx = dx * scale;
    const ny = dy * scale;

    setKnob({ x: nx, y: ny });
    onAxis(
      Math.abs(nx) < DEAD_ZONE ? 0 : nx,
      Math.abs(ny) < DEAD_ZONE ? 0 : ny
    );
  }, [onAxis]);

  return (
    <div
      ref={baseRef}
      onPointerDown={(e) => {
        if (pointerIdRef.current !== null) return;
        pointerIdRef.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        track(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (pointerIdRef.current !== e.pointerId) return;
        track(e.clientX, e.clientY);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      className={`relative ${sizeClass} ${shell} rounded-full border shadow-xl shrink-0 touch-none select-none flex items-center justify-center`}
      aria-label="Movement stick"
      role="application"
    >
      {/* Guide rings */}
      <div className="absolute inset-2 rounded-full border border-white/10 pointer-events-none" />
      <div className="absolute w-[1px] h-3 bg-white/15 top-1 pointer-events-none" />

      {/* Knob */}
      <div
        className="absolute w-1/2 h-1/2 rounded-full bg-white/90 border-2 border-white shadow-[0_0_18px_rgba(255,255,255,0.35)] pointer-events-none"
        style={{
          transform: `translate(${knob.x * 42}%, ${knob.y * 42}%)`,
          transition: knob.x === 0 && knob.y === 0 ? 'transform 120ms ease-out' : 'none',
        }}
      />
    </div>
  );
};

export default AnalogStick;
