import React from 'react';
import { GameStats } from '../game/types';

interface EndScreenProps {
  stats: GameStats;
  onRestart: () => void;
  onHome: () => void;
}

export default function EndScreen({ stats, onRestart, onHome }: EndScreenProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black text-white p-4">
      <h1 className="text-5xl md:text-7xl mb-12 text-center leading-tight">
        {stats.victory ? 'MISSION\nACCOMPLISHED' : 'GAME\nOVER'}
      </h1>

      <div className="w-full max-w-xs mb-12">
        <div className="border-2 border-white p-6 text-center">
          <div className="text-4xl mb-2">{stats.score}</div>
          <div className="text-[10px] text-gray-500 tracking-widest">FINAL SCORE</div>
        </div>
      </div>

      <div className="flex gap-4">
        <button 
          onClick={onHome}
          className="text-sm tracking-widest border-2 border-white text-white px-8 py-4 hover:bg-white hover:text-black transition-colors uppercase"
        >
          Home
        </button>
        <button 
          onClick={onRestart}
          className="text-sm tracking-widest bg-white text-black px-8 py-4 hover:bg-red-600 hover:text-white transition-colors uppercase"
        >
          Play Again
        </button>
      </div>
    </div>
  );
}
