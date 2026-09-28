import React, { useEffect, useState } from 'react';
import { CardSwap, Card } from './ui/CardSwap';
import { Mail, Terminal, Briefcase, User } from 'lucide-react';
import SiteHeader from './ui/SiteHeader';

interface ContactPageProps {
  onNavigate: (scene: string | null) => void;
}

/** Horizontal step between stacked cards. Phones get a tighter cascade so the stack fits. */
const CARD_STEP_PX = 60;
const CARD_STEP_NARROW_PX = 30;
const CARD_COUNT = 4;
const NARROW_QUERY = '(max-width: 480px)';

function useIsNarrow() {
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW_QUERY).matches);
  useEffect(() => {
    const query = window.matchMedia(NARROW_QUERY);
    const update = () => setNarrow(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return narrow;
}

const ContactPage: React.FC<ContactPageProps> = ({ onNavigate }) => {
  const narrow = useIsNarrow();
  const cardStep = narrow ? CARD_STEP_NARROW_PX : CARD_STEP_PX;
  /* The stack cascades to the right; shift it back by half so the whole stack is centred. */
  const stackShift = narrow ? -((CARD_COUNT - 1) * cardStep) / 2 : 0;

  return (
    <div className="w-full h-dvh bg-black text-white relative flex flex-col overflow-hidden animate-in fade-in duration-[2000ms]">
      <style>{`
        .noise::before {
          content: "";
          position: absolute;
          top: 0; left: 0; width: 100%; height: 100%;
          pointer-events: none; opacity: 0.05;
          background: url('/noise.svg');
          z-index: 50;
        }
      `}</style>
      <div className="absolute inset-0 noise mix-blend-difference pointer-events-none" />
      
      <SiteHeader title="APPARITIONS: CONTACT" current="contact" onNavigate={onNavigate} />

      {/* CardSwap Area */}
      <div className="w-full flex-1 flex flex-col items-center justify-center relative pt-[280px] pb-24 z-10 px-8">
        <div style={{ transform: `translateX(${stackShift}px)` }}>
        <CardSwap width={260} height={280} skewAmount={4} cardDistance={cardStep}>
          <Card 
            className="flex flex-col items-center justify-center p-6 text-center border border-white/20 rounded-xl overflow-hidden bg-[#0a0a0a] shadow-[0_0_80px_rgba(255,255,255,0.15)] gap-6"
            style={{ backgroundImage: `url('/images/contact_id_bg_1774972127283.png')`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundBlendMode: 'luminosity' }}
          >
            <div className="absolute inset-0 bg-black/60 rounded-xl" />
            <div className="relative z-10 select-text">
              <div className="text-[12px] uppercase font-bold tracking-[0.4em] text-white/50 mb-2 border-b border-white/20 pb-2 inline-block">ID</div>
              <h2 className="text-xl font-display font-bold tracking-tighter text-white mt-4 drop-shadow-md whitespace-nowrap selection:bg-white/30">Jason Darby</h2>
            </div>
          </Card>
          
          <Card 
            className="flex flex-col items-center justify-center p-6 text-center border border-white/20 rounded-xl overflow-hidden bg-[#0a0a0a] shadow-[0_0_80px_rgba(255,255,255,0.15)] gap-6"
            style={{ backgroundImage: `url('/images/contact_email_bg_1774972141323.png')`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundBlendMode: 'luminosity' }}
          >
            <div className="absolute inset-0 bg-black/60 rounded-xl" />
            <div className="relative z-10 select-text w-full">
              <div className="text-[12px] uppercase font-bold tracking-[0.4em] text-white/50 mb-2 border-b border-white/20 pb-2 inline-block">Email</div>
              <h2 className="text-[15px] font-display font-bold tracking-tight text-white mt-4 drop-shadow-md whitespace-nowrap selection:bg-white/30">jsndarby1@gmail.com</h2>
            </div>
          </Card>
          
          <Card 
            className="flex flex-col items-center justify-center p-6 text-center border border-white/20 rounded-xl overflow-hidden bg-[#0a0a0a] shadow-[0_0_80px_rgba(255,255,255,0.15)] gap-6"
            style={{ backgroundImage: `url('/images/contact_github_bg_1774972157896.png')`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundBlendMode: 'luminosity' }}
          >
            <div className="absolute inset-0 bg-black/60 rounded-xl" />
            <div className="relative z-10 select-text">
              <div className="text-[12px] uppercase font-bold tracking-[0.4em] text-white/50 mb-2 border-b border-white/20 pb-2 inline-block">GitHub</div>
              <h2 className="text-xl font-display font-bold tracking-tighter text-white mt-4 flex flex-col drop-shadow-md whitespace-nowrap selection:bg-white/30">json-darby</h2>
            </div>
          </Card>
          
          <Card 
            className="flex flex-col items-center justify-center p-6 text-center border border-white/20 rounded-xl overflow-hidden bg-[#0a0a0a] shadow-[0_0_80px_rgba(255,255,255,0.15)] gap-6"
            style={{ backgroundImage: `url('/images/contact_linkedin_bg_1774972175177.png')`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundBlendMode: 'luminosity' }}
          >
            <div className="absolute inset-0 bg-black/60 rounded-xl" />
            <div className="relative z-10 select-text">
              <div className="text-[12px] uppercase font-bold tracking-[0.4em] text-white/50 mb-2 border-b border-white/20 pb-2 inline-block">LinkedIn</div>
              <h2 className="text-xl font-display font-bold tracking-tighter text-white/70 mt-4 drop-shadow-md whitespace-nowrap selection:bg-white/30">N/A</h2>
            </div>
          </Card>
        </CardSwap>
        </div>
        
        {/* Keyboard legend: hidden on touch screens, which have no keyboard to use it with */}
        <div className="mt-16 flex [@media(hover:none)]:hidden whitespace-nowrap items-center justify-center gap-8 text-[10px] font-bold uppercase tracking-[0.2em] text-[#555] select-none opacity-40 hover:opacity-100 transition-opacity duration-700">
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="px-2 py-1 border border-[#333] rounded bg-[#111] text-white/70">←</span>
              <span className="px-2 py-1 border border-[#333] rounded bg-[#111] text-white/70">→</span>
            </span>
            MOVE
          </span>
          <span className="h-4 w-[1px] bg-[#333]" />
          <span className="flex items-center gap-3">
            <span className="px-3 py-1 border border-[#333] rounded bg-[#111] text-white/70">SPACE</span>
            PAUSE / RESUME
          </span>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
