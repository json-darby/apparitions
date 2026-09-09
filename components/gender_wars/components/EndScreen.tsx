import React from 'react';
import { GameStats } from '../game/types';

interface EndScreenProps {
  stats: GameStats;
  onRestart: () => void;
  onHome: () => void;
}

export default function EndScreen({ stats, onRestart, onHome }: EndScreenProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black text-white p-3 md:p-6 overflow-y-auto">
      <h1 className="text-3xl sm:text-4xl md:text-7xl mb-4 sm:mb-8 md:mb-12 text-center leading-tight font-bold">
        {stats.victory ? 'MISSION\nACCOMPLISHED' : 'GAME\nOVER'}
      </h1>

      <div className="w-full max-w-xs mb-4 sm:mb-8 md:mb-12">
        <div className="border-2 border-white p-4 sm:p-6 text-center shadow-xl">
          <div className="text-2xl sm:text-4xl mb-1 md:mb-2 font-mono font-bold">{stats.score}</div>
          <div className="text-[9px] md:text-[10px] text-gray-400 tracking-widest font-mono">FINAL SCORE</div>
        </div>
      </div>

      <div className="flex gap-3 md:gap-4">
        <button 
          onClick={onHome}
          className="text-xs sm:text-sm tracking-widest border-2 border-white text-white px-5 sm:px-8 py-2.5 sm:py-4 hover:bg-white hover:text-black transition-colors uppercase active:scale-95 font-bold"
        >
          Home
        </button>
        <button 
          onClick={onRestart}
          className="text-xs sm:text-sm tracking-widest bg-white text-black px-5 sm:px-8 py-2.5 sm:py-4 hover:bg-red-600 hover:text-white transition-colors uppercase active:scale-95 font-bold"
        >
          Play Again
        </button>
      </div>
    </div>
  );
}
