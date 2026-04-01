import React from 'react';

export default function StartScreen({ onStart }: { onStart: () => void }) {
  return (
    // Changed overflow-y-auto to overflow-hidden and adjusted padding
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black text-white p-2 md:p-4 overflow-hidden">

      {/* Reduced bottom margin and adjusted text sizing for better scaling */}
      <div className="text-center mb-6 md:mb-8 mt-4">
        <h2 className="text-red-600 text-[8px] md:text-xs tracking-[0.3em] mb-2 uppercase">Apparitions presents...</h2>
        <h1 className="text-3xl md:text-5xl lg:text-6xl leading-tight mb-1 uppercase">
          Gender <span className="text-red-600">Wars</span>
        </h1>
        <p className="text-gray-400 text-[8px] md:text-xs tracking-widest mt-2">Space Impact Edition</p>
      </div>

      {/* Reduced max-width and internal padding so it doesn't push the button off-screen */}
      <div className="border border-gray-800 p-4 md:p-6 max-w-lg w-full relative mb-6 md:mb-8 rounded-none bg-black/40 shadow-xl">
        <div className="absolute -top-2 left-4 bg-black px-2 text-red-600 text-[10px] tracking-widest">
          HOW TO PLAY
        </div>

        <div className="space-y-3 text-[10px] md:text-xs text-gray-300">
          <div className="flex items-center gap-4 border-b border-gray-800 pb-2">
            <span className="bg-white text-black px-2 py-1 min-w-[80px] text-center">WASD/ARROWS</span>
            <span>Move Ship</span>
          </div>
          <div className="flex items-center gap-4 border-b border-gray-800 pb-2">
            <span className="bg-white text-black px-2 py-1 min-w-[80px] text-center">SHIFT</span>
            <span>Toggle DE / HET</span>
          </div>
          <div className="flex items-center gap-4 border-b border-gray-800 pb-2">
            <span className="bg-white text-black px-2 py-1 min-w-[80px] text-center">SPACE</span>
            <span>Fire</span>
          </div>
          <div className="flex items-center gap-4 pt-1">
            <span className="text-red-600 min-w-[80px] text-center text-sm md:text-base font-bold">S / H</span>
            <span>Powerups: Slow / Hint</span>
          </div>
        </div>
      </div>

      {/* Scaled down the button slightly on smaller screens to ensure it always fits */}
      <button
        onClick={onStart}
        className="text-sm md:text-xl tracking-widest bg-white text-black px-8 py-3 md:px-12 md:py-4 hover:bg-red-600 hover:text-white transition-colors uppercase mb-4"
      >
        Start Mission
      </button>
    </div>
  );
}