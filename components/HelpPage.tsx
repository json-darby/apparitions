import React from 'react';

interface HelpPageProps {
  onNavigate: (scene: string | null) => void;
}

const HelpPage: React.FC<HelpPageProps> = ({ onNavigate }) => {
  return (
    <div className="w-full h-screen bg-black text-white relative flex flex-col items-center justify-center overflow-hidden animate-in fade-in duration-[3000ms]">
      <style>{`
        .noise::before {
          content: "";
          position: absolute;
          top: 0; left: 0; width: 100%; height: 100%;
          pointer-events: none; opacity: 0.05;
          background: url('https://grainy-gradients.vercel.app/noise.svg');
          z-index: 50;
        }
      `}</style>
      <div className="absolute inset-0 noise mix-blend-difference" />
      
      {/* Top Header */}
      <nav className="fixed top-0 left-0 w-full h-[100px] z-[100] px-8 md:px-12 flex items-center justify-between pointer-events-none mix-blend-difference flex-shrink-0">
        <div className="font-display font-bold text-2xl tracking-tighter text-white pointer-events-auto">
          APPARITIONS: ?
        </div>
        
        <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-[40px] text-xs font-bold tracking-[0.2em] pointer-events-auto">
          <button onClick={() => onNavigate(null)} className="text-[#555] hover:text-white transition-colors duration-300 tracking-[0.2em] focus:outline-none">HOME</button>
          <button onClick={() => onNavigate('menu')} className="text-[#555] hover:text-white transition-colors duration-300 tracking-[0.2em] focus:outline-none">GAMES</button>
          <button onClick={() => onNavigate('core')} className="text-[#555] hover:text-white transition-colors duration-300 tracking-[0.2em] focus:outline-none">CORE</button>
          <button onClick={() => onNavigate('nexus')} className="text-[#555] hover:text-white transition-colors duration-300 tracking-[0.2em] focus:outline-none">NEXUS</button>
          <button className="text-white font-bold transition-colors duration-300 tracking-[0.2em] focus:outline-none drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] cursor-default">HELP</button>
        </div>
        
        <div className="pointer-events-auto">
          <button onClick={() => onNavigate('contact')} className="px-6 py-2 border border-white/20 rounded-full text-xs font-bold uppercase tracking-wider text-white hover:bg-white hover:text-black transition-colors duration-500">
            Contact
          </button>
        </div>
      </nav>
      
      {/* Empty space below header as requested */}
      <div className="flex-1 flex items-center justify-center">
        {/* Intentionally left blank */}
      </div>

      <div className="absolute bottom-[5vh] md:bottom-10 left-4 md:left-12 z-30 pointer-events-none transition-all duration-300">
        <h1 className="font-display font-bold text-[10vw] md:text-[8vw] leading-[0.8] tracking-tighter text-white animate-in slide-in-from-left-8 duration-700 whitespace-nowrap">
          YOU DON'T NEED HELP
        </h1>
      </div>
    </div>
  );
};

export default HelpPage;
