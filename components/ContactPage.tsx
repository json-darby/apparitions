import React from 'react';
import { CardSwap, Card } from './ui/CardSwap';
import { Mail, Terminal, Briefcase, User } from 'lucide-react';

interface ContactPageProps {
  onNavigate: (scene: string | null) => void;
}

const ContactPage: React.FC<ContactPageProps> = ({ onNavigate }) => {
  return (
    <div className="w-full h-screen bg-black text-white relative flex flex-col overflow-hidden animate-in fade-in duration-[2000ms]">
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
      <div className="absolute inset-0 noise mix-blend-difference pointer-events-none" />
      
      {/* Top Header */}
      <nav className="fixed top-0 left-0 w-full h-[100px] z-[100] px-8 md:px-12 flex items-center justify-between pointer-events-none mix-blend-difference flex-shrink-0">
        <div className="font-display font-bold text-2xl tracking-tighter text-white pointer-events-auto">
          APPARITIONS: CONTACT
        </div>
        
        <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-[40px] text-xs font-bold tracking-[0.2em] pointer-events-auto">
          <button onClick={() => onNavigate(null)} className="text-[#555] hover:text-white transition-colors duration-300 tracking-[0.2em] focus:outline-none">HOME</button>
          <button onClick={() => onNavigate('menu')} className="text-[#555] hover:text-white transition-colors duration-300 tracking-[0.2em] focus:outline-none">GAMES</button>
          <button onClick={() => onNavigate('core')} className="text-[#555] hover:text-white transition-colors duration-300 tracking-[0.2em] focus:outline-none">CORE</button>
          <button onClick={() => onNavigate('nexus')} className="text-[#555] hover:text-white transition-colors duration-300 tracking-[0.2em] focus:outline-none">NEXUS</button>
          <button onClick={() => onNavigate('help')} className="text-[#555] hover:text-white transition-colors duration-300 tracking-[0.2em] focus:outline-none">HELP</button>
        </div>
        
        <div className="pointer-events-auto">
          <button className="px-6 py-2 border border-white rounded-full text-xs font-bold uppercase tracking-wider text-black bg-white transition-colors duration-500 cursor-default">
            Contact
          </button>
        </div>
      </nav>

      {/* CardSwap Area */}
      <div className="w-full flex-1 flex flex-col items-center justify-center relative pt-[280px] pb-24 z-10 px-8">
        <CardSwap width={260} height={280} skewAmount={4}>
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
        
        {/* Navigation Legend */}
        <div className="mt-16 flex items-center justify-center gap-8 text-[10px] font-bold uppercase tracking-[0.2em] text-[#555] select-none opacity-40 hover:opacity-100 transition-opacity duration-700">
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
