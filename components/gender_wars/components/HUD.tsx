import React from 'react';
import { Zap } from 'lucide-react';
import { ArticleMode } from '../game/types';

interface HUDProps {
  state: {
    score: number;
    lives: number;
    level: number;
    mode: ArticleMode;
    slowActive: boolean;
    hintActive: boolean;
    paused?: boolean;
    specialWeaponState?: 'ready' | 'charging' | 'firing';
  };
  onPauseToggle?: () => void;
  onSpecialWeapon?: () => void;
  onToggleMode?: () => void;
  onQuit?: () => void;
}

const TulipIcon = ({ active }: { active: boolean; key?: number | string }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" shapeRendering="crispEdges" className="inline-block">
    <rect x="4" y="2" width="2" height="2" fill={active ? "#FF0000" : "#333333"} />
    <rect x="7" y="2" width="2" height="2" fill={active ? "#FF0000" : "#333333"} />
    <rect x="10" y="2" width="2" height="2" fill={active ? "#FF0000" : "#333333"} />
    <rect x="3" y="4" width="10" height="4" fill={active ? "#FF0000" : "#333333"} />
    <rect x="5" y="8" width="6" height="2" fill={active ? "#FF0000" : "#333333"} />
    <rect x="7" y="10" width="2" height="6" fill={active ? "#00FF00" : "#333333"} />
  </svg>
);

export default function HUD({ state, onPauseToggle, onSpecialWeapon, onToggleMode, onQuit }: HUDProps) {
  const levels = ['A0', 'A1', 'A2', 'B1'];

  return (
    <div className="w-full bg-black border-b border-gray-800 p-2 flex justify-between items-center z-10 shrink-0 select-none">
      {/* Left: Exit, Score, Level, Pause */}
      <div className="flex items-center gap-2.5 sm:gap-3 md:gap-4">
        {onQuit && (
          <button 
            onClick={onQuit}
            className="text-[8px] md:text-[9px] font-mono font-bold tracking-widest text-gray-400 hover:text-white border border-white/25 px-1.5 py-0.5 uppercase active:bg-white active:text-black transition-colors"
            title="Exit Mission"
          >
            EXIT
          </button>
        )}
        <div>
          <div className="text-[7px] md:text-[8px] text-gray-500 mb-0.5 font-mono">SCORE</div>
          <div className="text-xs md:text-sm font-mono font-bold">{state.score.toString().padStart(6, '0')}</div>
        </div>
        <div>
          <div className="text-[7px] md:text-[8px] text-gray-500 mb-0.5 font-mono">LEVEL</div>
          <div className="text-xs md:text-sm text-red-600 font-mono font-bold">{levels[state.level]}</div>
        </div>
        <button 
          onClick={onPauseToggle}
          className="pointer-events-auto text-base md:text-lg text-white hover:text-red-500 transition-colors ml-0.5 font-mono font-bold"
          title="Pause Game"
        >
          ||
        </button>
      </div>

      {/* Centre: Articles & Beam */}
      <div className="flex items-center gap-3 md:gap-6">
        <div className="flex gap-1.5 md:gap-2">
          <button 
            onClick={onToggleMode}
            className={`px-2 md:px-3 py-1 text-[10px] md:text-xs border transition-colors cursor-pointer pointer-events-auto font-mono font-bold ${
              state.mode === 'de' ? 'bg-red-600 border-red-600 text-white' : 'border-gray-800 text-gray-600 hover:text-white'
            }`}
            title="Toggle article (Shift / Tap)"
          >
            DE
          </button>
          <button 
            onClick={onToggleMode}
            className={`px-2 md:px-3 py-1 text-[10px] md:text-xs border transition-colors cursor-pointer pointer-events-auto font-mono font-bold ${
              state.mode === 'het' ? 'bg-white border-white text-black' : 'border-gray-800 text-gray-600 hover:text-white'
            }`}
            title="Toggle article (Shift / Tap)"
          >
            HET
          </button>
        </div>

        <button 
          onClick={onSpecialWeapon}
          disabled={state.specialWeaponState !== 'ready' || state.lives <= 0}
          className={`hidden sm:flex items-center gap-1 text-[10px] md:text-xs font-bold transition-colors pointer-events-auto ${
            state.specialWeaponState === 'ready' 
              ? 'text-cyan-400 hover:text-cyan-300 cursor-pointer' 
              : state.specialWeaponState === 'charging' 
              ? 'text-cyan-200 animate-pulse' 
              : 'text-gray-600'
          }`}
        >
          <Zap className="w-3.5 h-3.5 md:w-4 md:h-4" />
          [R] BEAM
        </button>
      </div>

      {/* Right: Tulips & Status */}
      <div className="flex flex-col items-end gap-1">
        <div className="flex gap-1">
          {[...Array(5)].map((_, i) => (
            <TulipIcon key={i} active={i < state.lives} />
          ))}
        </div>
        <div className="flex gap-2">
          {state.slowActive && <div className="text-red-600 text-[10px] animate-pulse">SLOW</div>}
          {state.hintActive && <div className="text-white text-[10px] animate-pulse">HINT</div>}
        </div>
      </div>
    </div>
  );
}
