import React from 'react';
import SiteHeader from './ui/SiteHeader';

interface HelpPageProps {
  onNavigate: (scene: string | null) => void;
}

const HelpPage: React.FC<HelpPageProps> = ({ onNavigate }) => {
  return (
    <div className="w-full h-dvh bg-black text-white relative flex flex-col items-center justify-center overflow-hidden animate-in fade-in duration-[3000ms]">
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
      
      <SiteHeader title="APPARITIONS: ?" current="help" onNavigate={onNavigate} />
      
      {/* Empty space below header as requested */}
      <div className="flex-1 flex items-center justify-center">
        {/* Intentionally left blank */}
      </div>

      <div className="absolute bottom-[5vh] md:bottom-10 left-4 right-4 md:left-12 md:right-auto z-30 pointer-events-none transition-all duration-300">
        <h1 className="font-display font-bold text-[clamp(1.75rem,8vw,3.5rem)] md:text-[8vw] leading-[0.8] tracking-tighter text-white animate-in slide-in-from-left-8 duration-700 whitespace-normal md:whitespace-nowrap break-words">
          YOU DON'T NEED HELP
        </h1>
      </div>
    </div>
  );
};

export default HelpPage;
