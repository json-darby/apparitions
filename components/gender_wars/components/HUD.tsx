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

export default function HUD({ state, onPauseToggle, onSpecialWeapon }: HUDProps) {
  const levels = ['A0', 'A1', 'A2', 'B1'];

  return (
    <div className="w-full bg-black border-b border-gray-800 p-2 flex justify-between items-start z-10 shrink-0">
      {/* Left: Score, Level, Pause */}
      <div className="flex items-center gap-4">
        <div>
          <div className="text-[8px] text-gray-500 mb-0.5">SCORE</div>
          <div className="text-sm">{state.score.toString().padStart(6, '0')}</div>
        </div>
        <div>
          <div className="text-[8px] text-gray-500 mb-0.5">LEVEL</div>
          <div className="text-sm text-red-600">{levels[state.level]}</div>
        </div>
        <button 
          onClick={onPauseToggle}
          className="pointer-events-auto text-lg text-white hover:text-red-500 transition-colors ml-2"
          title="Pause Game"
        >
          ||
        </button>
      </div>

      {/* Center: Articles & Beam */}
      <div className="flex items-center gap-6">
        <div className="flex gap-2">
          <div className={`px-3 py-1 text-xs border ${state.mode === 'de' ? 'bg-red-600 border-red-600 text-white' : 'border-gray-800 text-gray-600'}`}>
            DE
          </div>
          <div className={`px-3 py-1 text-xs border ${state.mode === 'het' ? 'bg-white border-white text-black' : 'border-gray-800 text-gray-600'}`}>
            HET
          </div>
        </div>

        <button 
          onClick={onSpecialWeapon}
          disabled={state.specialWeaponState !== 'ready' || state.lives <= 0}
          className={`flex items-center gap-1 text-xs font-bold transition-colors pointer-events-auto ${state.specialWeaponState === 'ready' ? 'text-cyan-400 hover:text-cyan-300 cursor-pointer' : state.specialWeaponState === 'charging' ? 'text-cyan-200 animate-pulse' : 'text-gray-600'}`}
        >
          <Zap className="w-4 h-4" />
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
