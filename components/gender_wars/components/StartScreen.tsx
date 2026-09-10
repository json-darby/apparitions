import React from 'react';

export default function StartScreen({ onStart, onQuit }: { onStart: () => void, onQuit?: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black text-white p-2 md:p-4 overflow-y-auto landscape:py-1">
      {onQuit && (
        <div className="absolute top-3 left-3 z-50">
          <button
            onClick={onQuit}
            className="font-display font-bold text-xs md:text-sm tracking-tighter text-white hover:opacity-70 transition-opacity"
          >
            RETURN
          </button>
        </div>
      )}

      <div className="text-center mb-3 md:mb-8 mt-1 landscape:mb-1 landscape:mt-0">
        <h2 className="text-red-600 text-[8px] md:text-xs tracking-[0.3em] mb-1 uppercase">Apparitions presents...</h2>
        <h1 className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl leading-tight mb-1 uppercase font-bold">
          Gender <span className="text-red-600">Wars</span>
        </h1>
        <p className="text-gray-400 text-[8px] md:text-xs tracking-widest mt-1">Space Impact Edition</p>
      </div>

      <div className="border border-gray-800 p-3 md:p-6 max-w-lg w-full relative mb-3 md:mb-8 rounded-none bg-black/40 shadow-xl landscape:mb-2 landscape:py-2">
        <div className="absolute -top-2 left-4 bg-black px-2 text-red-600 text-[9px] md:text-[10px] tracking-widest font-mono">
          HOW TO PLAY
        </div>

        <div className="space-y-1.5 md:space-y-3 text-[8px] sm:text-[9px] md:text-xs text-gray-300 font-mono">
          <div className="flex items-center gap-2 md:gap-4 border-b border-gray-800 pb-1.5">
            <span className="bg-white text-black px-1.5 md:px-2 py-0.5 md:py-1 min-w-[70px] md:min-w-[80px] text-center font-bold text-[8px] md:text-[10px]">DRAG / KEYS</span>
            <span>Move Ship</span>
          </div>
          <div className="flex items-center gap-2 md:gap-4 border-b border-gray-800 pb-1.5">
            <span className="bg-white text-black px-1.5 md:px-2 py-0.5 md:py-1 min-w-[70px] md:min-w-[80px] text-center font-bold text-[8px] md:text-[10px]">DE / HET</span>
            <span>Toggle Mode</span>
          </div>
          <div className="flex items-center gap-2 md:gap-4 border-b border-gray-800 pb-1.5">
            <span className="bg-white text-black px-1.5 md:px-2 py-0.5 md:py-1 min-w-[70px] md:min-w-[80px] text-center font-bold text-[8px] md:text-[10px]">FIRE / TAP</span>
            <span>Blast Words</span>
          </div>
          <div className="flex items-center gap-2 md:gap-4 pt-0.5">
            <span className="text-red-600 min-w-[70px] md:min-w-[80px] text-center text-[9px] md:text-base font-bold">BEAM / S / H</span>
            <span>Super Weapon</span>
          </div>
        </div>
      </div>

      <button
        onClick={onStart}
        className="text-xs sm:text-sm md:text-xl tracking-widest bg-white text-black px-6 py-2.5 md:px-12 md:py-4 hover:bg-red-600 hover:text-white transition-colors uppercase mb-2 landscape:mb-1 landscape:py-1.5 active:scale-95 font-bold"
      >
        Start Mission
      </button>
    </div>
  );
}