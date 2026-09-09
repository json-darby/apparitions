
import React, { useState } from 'react';
import { ScenarioType } from './types';
import ChatWindow from './components/ChatWindow';
import { MemoryGame } from './components/MemoryGame';
import { ComprehensionGame } from './components/ComprehensionGame';
import NexusView from './components/NexusView';
import Core from './components/Core';
import GenderWarsGame from './components/gender_wars/GenderWarsGame';
import ContactPage from './components/ContactPage';
import HelpPage from './components/HelpPage';

const DigitalAberrationStyles = () => (
  <style>{`
    @keyframes digital-aberration {
      0% { transform: translate(0) skew(0deg); opacity: 0; filter: blur(4px); }
      10% { transform: translate(-2px, 1px) skew(5deg); opacity: 1; filter: blur(0px); }
      20% { transform: translate(2px, -1px) skew(-5deg); filter: contrast(150%) brightness(150%); }
      30% { transform: translate(0) skew(0deg); filter: none; }
      100% { transform: translate(0) skew(0deg); opacity: 1; filter: none; }
    }
    .animate-digital-aberration {
      animation: digital-aberration 0.3s ease-out forwards;
    }
  `}</style>
);

const SCENARIO_DETAILS = {
  [ScenarioType.INTRO]: { title: '01 / The Encounter' },
  [ScenarioType.COFFEE]: { title: '02 / Night Shift' },
  [ScenarioType.COMPREHENSION]: { title: '03 / Deep Comprehension' },
  [ScenarioType.FREESPEECH]: { title: '04 / Free Space' }
};

const STATS = [
  { label: 'Fluency Focus', value: 'EN-NL' },
  { label: 'Avg Duration', value: '~15 MIN' },
  { label: 'Algorithm', value: 'A0-A2 ADAPTIVE' },
  { label: 'Immersion', value: '100%' }
];

const App: React.FC = () => {
  const [currentScenario, setCurrentScenario] = useState<ScenarioType | null>(null);

  // 'menu' for the selection screen, 'memory' for the active pair match game, 'comprehension' for the redacted transcript game, 'nexus' for the 3D diorama, 'core' for new engine, 'gender_wars' for the imported game, null for landing page
  const [gameScene, setGameScene] = useState<'menu' | 'memory' | 'comprehension' | 'nexus' | 'core' | 'gender_wars' | 'help' | 'contact' | null>(null);
  const [isMemoryGameWon, setIsMemoryGameWon] = useState(false);
  const [isComprehensionGameWon, setIsComprehensionGameWon] = useState(false);
  const [menuText, setMenuText] = useState('LATEN WE SPELEN');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const COMING_SOON_DELAY_MS = 2000;

  if (currentScenario) {
    return (
      <div className="w-full h-screen bg-editorial-bg text-white overflow-hidden animate-in fade-in duration-1000">
        <ChatWindow scenario={currentScenario} onExit={() => setCurrentScenario(null)} />
      </div>
    );
  }

  if (gameScene === 'menu') {
    return (
      <div className="w-full h-screen bg-black text-white relative flex flex-col items-center justify-center overflow-hidden animate-in fade-in duration-1000">
        <DigitalAberrationStyles />

        {/* Top Header - mirrored from landing page */}
        <nav className="fixed top-0 left-0 w-full h-[65px] md:h-[100px] z-50 mix-blend-difference px-4 md:px-12 flex items-center justify-between">
          <div className="font-display font-bold text-xl md:text-2xl tracking-tighter text-white pointer-events-auto">
            APPARITIONS: SPELEN
          </div>

          {/* Centre Navigation Links */}
          <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-[40px] text-xs font-bold tracking-[0.2em] pointer-events-auto">
            <button onClick={() => setGameScene(null)} className="text-[#555] hover:text-white transition-colors duration-300 tracking-[0.2em] focus:outline-none">HOME</button>
            <button className="text-white font-bold transition-colors duration-300 tracking-[0.2em] focus:outline-none drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] cursor-default">GAMES</button>
            <button onClick={() => setGameScene('core')} className="text-[#555] hover:text-white transition-colors duration-300 tracking-[0.2em] focus:outline-none">CORE</button>
            <button onClick={() => setGameScene('nexus')} className="text-[#555] hover:text-white transition-colors duration-300 tracking-[0.2em] focus:outline-none">NEXUS</button>
            <button onClick={() => setGameScene('help')} className="text-[#555] hover:text-white transition-colors duration-300 tracking-[0.2em] focus:outline-none">HELP</button>
          </div>

          {/* Right - Contact / Mobile Menu */}
          <div className="pointer-events-auto flex items-center gap-3">
            <button 
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="md:hidden px-3 py-1.5 border border-white/30 text-white text-[10px] font-mono tracking-widest uppercase hover:bg-white hover:text-black transition-colors"
            >
              {mobileNavOpen ? '✕ CLOSE' : '☰ MENU'}
            </button>
            <button onClick={() => setGameScene('contact')} className="hidden sm:inline-block px-6 py-2 border border-white/20 rounded-full text-xs font-bold uppercase tracking-wider text-white hover:bg-white hover:text-black transition-colors duration-500">
              Contact
            </button>
          </div>
        </nav>

        {/* Mobile Nav Overlay */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="w-full max-w-sm flex flex-col items-start gap-8">
              <div className="border-b border-white/20 pb-4 w-full flex justify-between items-baseline">
                <div>
                  <span className="text-[9px] font-mono text-red-500 tracking-[0.3em] uppercase block">SYSTEM TERMINAL</span>
                  <h3 className="text-xl font-display font-bold tracking-tighter text-white">APPARITIONS</h3>
                </div>
                <span className="text-[10px] font-mono text-gray-500">v2.6 // SECURE</span>
              </div>

              <div className="flex flex-col gap-5 w-full font-mono text-sm tracking-[0.2em]">
                <button onClick={() => { setGameScene(null); setMobileNavOpen(false); }} className="text-left text-gray-400 hover:text-white flex items-center gap-3 transition-colors group">
                  <span className="text-red-600 text-xs font-bold">01</span>
                  <span className="group-hover:translate-x-1 transition-transform">HOME ARCHIVE</span>
                </button>
                <button onClick={() => { setGameScene('menu'); setMobileNavOpen(false); }} className="text-left text-white font-bold flex items-center gap-3 transition-colors group">
                  <span className="text-red-500 text-xs font-bold">02</span>
                  <span className="text-red-500 group-hover:translate-x-1 transition-transform">GAMES COMPENDIUM ▶</span>
                </button>
                <button onClick={() => { setGameScene('core'); setMobileNavOpen(false); }} className="text-left text-gray-400 hover:text-white flex items-center gap-3 transition-colors group">
                  <span className="text-red-600 text-xs font-bold">03</span>
                  <span className="group-hover:translate-x-1 transition-transform">CORE LESSONS</span>
                </button>
                <button onClick={() => { setGameScene('nexus'); setMobileNavOpen(false); }} className="text-left text-gray-400 hover:text-white flex items-center gap-3 transition-colors group">
                  <span className="text-red-600 text-xs font-bold">04</span>
                  <span className="group-hover:translate-x-1 transition-transform">3D NEXUS DIORAMA</span>
                </button>
                <button onClick={() => { setGameScene('help'); setMobileNavOpen(false); }} className="text-left text-gray-400 hover:text-white flex items-center gap-3 transition-colors group">
                  <span className="text-red-600 text-xs font-bold">05</span>
                  <span className="group-hover:translate-x-1 transition-transform">INTELLIGENCE HELP</span>
                </button>
                <button onClick={() => { setGameScene('contact'); setMobileNavOpen(false); }} className="text-left text-gray-400 hover:text-white flex items-center gap-3 transition-colors group">
                  <span className="text-red-600 text-xs font-bold">06</span>
                  <span className="group-hover:translate-x-1 transition-transform">DISPATCH CONTACT</span>
                </button>
              </div>

              <div className="w-full pt-6 border-t border-white/10 flex justify-between items-center">
                <button
                  onClick={() => setMobileNavOpen(false)}
                  className="px-6 py-2.5 border border-white/30 text-xs font-mono tracking-[0.2em] text-white hover:bg-white hover:text-black transition-all active:scale-95 uppercase"
                >
                  [✕] ESCAPE
                </button>
                <span className="text-[9px] font-mono text-gray-600 tracking-widest">EN-NL IMMERSION</span>
              </div>
            </div>
          </div>
        )}

        {/* Backing large text matched to the landing page style */}
        <div className="absolute bottom-[2vh] md:bottom-10 left-3 md:left-12 z-0 pointer-events-none transition-all duration-300 opacity-30 md:opacity-100">
          <h1 className="font-display font-bold text-[12vw] md:text-[8vw] leading-[0.8] tracking-tighter text-white animate-in slide-in-from-left-8 duration-700">
            {menuText}
          </h1>
        </div>

        {/* Centre Selection Image / Responsive Cards */}
        <div className="relative w-full max-w-[95vw] md:max-w-5xl lg:max-w-6xl xl:max-w-[1200px] flex flex-col md:flex-row h-auto md:max-h-[60vh] md:aspect-[21/9] z-10 animate-in fade-in slide-in-from-bottom-10 duration-1000 rounded-none overflow-hidden mx-auto gap-3 md:gap-0 my-auto px-2 md:px-0">
          {/* Left Side: Memory Game */}
          <div
            onClick={() => setGameScene('memory')}
            className="w-full md:w-1/3 h-24 sm:h-28 md:h-full relative cursor-pointer group border border-white/20 md:border-y-0 md:border-l-0 md:border-r overflow-hidden flex items-center justify-center bg-[#0a0a0a] md:bg-transparent transition-colors hover:bg-white/5 active:scale-98"
          >
            <div className="absolute inset-0 flex items-center justify-center px-4">
              <span className="font-display font-bold text-lg sm:text-xl md:text-3xl text-center tracking-widest uppercase transition-transform duration-500 group-hover:scale-110">Pair Match</span>
            </div>
          </div>

          {/* Middle Side: Gender Wars */}
          <div
            onClick={() => setGameScene('gender_wars')}
            className="w-full md:w-1/3 h-24 sm:h-28 md:h-full relative cursor-pointer group border border-white/20 md:border-y-0 md:border-l-0 md:border-r overflow-hidden flex items-center justify-center bg-[#0a0a0a] md:bg-transparent transition-colors hover:bg-white/5 active:scale-98"
          >
            {/* Animated Target SVG Background */}
            <svg viewBox="0 0 100 100" className="absolute w-[80%] h-[80%] opacity-20 group-hover:opacity-40 transition-all duration-1000 text-white/50 group-hover:text-white animate-[pulse_4s_ease-in-out_infinite]">
              <g className="origin-center animate-[spin_40s_linear_infinite]">
                <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4 8" />
                <circle cx="50" cy="50" r="35" fill="none" stroke="currentColor" strokeWidth="0.5" />
                <line x1="0" y1="50" x2="100" y2="50" stroke="currentColor" strokeWidth="0.5" />
                <line x1="50" y1="0" x2="50" y2="100" stroke="currentColor" strokeWidth="0.5" />
              </g>
              {/* Jet/Spaceship */}
              <path d="M50 25 L55 40 L70 48 L70 54 L55 52 L55 65 L60 72 L40 72 L45 65 L45 52 L30 54 L30 48 L45 40 Z" fill="none" stroke="currentColor" strokeWidth="1.5" className="origin-center group-hover:scale-110 transition-transform duration-1000" />
            </svg>

            <div className="absolute inset-0 flex items-center justify-center px-4 mix-blend-screen">
              <span className="font-display font-bold text-lg sm:text-xl md:text-3xl text-center tracking-widest uppercase transition-transform duration-500 group-hover:scale-110 z-10 drop-shadow-md text-red-500 md:text-white">Gender Wars</span>
            </div>
          </div>

          {/* Right Side: Comprehension Game */}
          <div
            onClick={() => setGameScene('comprehension')}
            className="w-full md:w-1/3 h-24 sm:h-28 md:h-full relative cursor-pointer group border border-white/20 md:border-none overflow-hidden flex items-center justify-center bg-[#0a0a0a] md:bg-transparent transition-colors hover:bg-white/5 active:scale-98"
          >
            <div className="absolute inset-0 flex items-center justify-center px-4">
              <span className="font-display font-bold text-lg sm:text-xl md:text-3xl text-center tracking-widest uppercase transition-transform duration-500 group-hover:scale-110 leading-tight">Redacted</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (gameScene === 'comprehension') {
    return (
      <div className="relative w-full h-screen bg-[#0a0a0c] text-white overflow-hidden animate-in fade-in duration-[3000ms]">
        <DigitalAberrationStyles />

        {/* CRT Scanline Overlay */}
        <div className="absolute inset-0 pointer-events-none z-50 mix-blend-overlay opacity-10 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.5)_50%)] bg-[length:100%_4px]" />

        {/* Minimal Nav to Exit */}
        <nav className="fixed top-0 left-0 w-full h-[65px] md:h-[100px] z-[60] mix-blend-difference px-4 md:px-12 flex items-center">
          <button
            onClick={() => { setGameScene('menu'); setIsComprehensionGameWon(false); }}
            className="font-display font-bold text-xl md:text-2xl tracking-tighter text-white hover:opacity-70 transition-opacity focus:outline-none"
          >
            RETURN
          </button>
        </nav>

        {/* Game Container */}
        <div className="relative z-10 w-full h-full flex flex-col items-center justify-center pt-16 md:pt-24 pb-2 md:pb-8 px-2 md:px-8">
          <ComprehensionGame
            onExit={() => { setGameScene('menu'); setIsComprehensionGameWon(false); }}
            onWin={() => setIsComprehensionGameWon(true)}
          />
        </div>
      </div>
    );
  }

  if (gameScene === 'memory') {
    return (
      <div className="w-full h-screen bg-black text-white overflow-hidden relative animate-in fade-in duration-[3000ms]">
        <DigitalAberrationStyles />

        {/* Full-screen Film Grain Noise Overlay */}
        <div
          className="absolute inset-0 opacity-[0.05] pointer-events-none mix-blend-overlay"
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}
        />

        {/* Minimal Nav to Exit - Styled exactly like the main APPARITIONS header */}
        <nav className="fixed top-0 left-0 w-full h-[65px] md:h-[100px] z-50 mix-blend-difference px-4 md:px-12 flex items-center">
          <button
            onClick={() => { setGameScene('menu'); setIsMemoryGameWon(false); }}
            className="font-display font-bold text-xl md:text-2xl tracking-tighter text-white hover:opacity-70 transition-opacity"
          >
            RETURN
          </button>
        </nav>

        {/* Game Container */}
        <div className="relative z-10 w-full h-full flex flex-col items-center justify-center pt-16 md:pt-20 px-2 sm:px-4">
          <MemoryGame
            onWin={() => setIsMemoryGameWon(true)}
            onRestart={() => setIsMemoryGameWon(false)}
          />
        </div>
      </div>
    );
  }

  if (gameScene === 'nexus') {
    return (
      <NexusView onExit={() => setGameScene(null)} onNavigate={(scene) => setGameScene(scene)} />
    );
  }

  if (gameScene === 'core') {
    return (
      <Core onExit={() => setGameScene(null)} onNavigate={(scene) => setGameScene(scene)} />
    );
  }

  if (gameScene === 'gender_wars') {
    return (
      <div className="w-full h-screen bg-black text-white relative flex flex-col items-center justify-center overflow-hidden animate-in fade-in duration-[3000ms]">
        <DigitalAberrationStyles />

        {/* Minimal navigation bar for desktop viewports (>= 1024px) */}
        <nav className="hidden lg:flex fixed top-0 left-0 w-full h-[80px] z-50 mix-blend-difference px-12 items-center pointer-events-none">
          <button
            onClick={() => setGameScene('menu')}
            className="font-display font-bold text-2xl tracking-tighter text-white hover:opacity-70 transition-opacity pointer-events-auto"
          >
            RETURN
          </button>
        </nav>

        {/* Game container: spans full viewport on mobile devices and provides a centred widescreen frame on desktop */}
        <div className="relative z-10 w-full h-full flex flex-col items-center justify-center pt-0 lg:pt-20 pb-0 lg:pb-6 px-0 lg:px-10 overflow-hidden">
          <GenderWarsGame onExit={() => setGameScene('menu')} />
        </div>
      </div>
    );
  }

  if (gameScene === 'contact') {
    return (
      <ContactPage onNavigate={(scene) => setGameScene(scene as any)} />
    );
  }

  if (gameScene === 'help') {
    return (
      <HelpPage onNavigate={(scene) => setGameScene(scene as any)} />
    );
  }

  return (
    <div className="min-h-screen bg-editorial-bg text-white font-body selection:bg-white/20 selection:text-white relative noise overflow-x-hidden">

      {/* Sticky Mix-Blend Nav */}
      <nav className="fixed top-0 left-0 w-full h-[65px] md:h-[100px] z-50 mix-blend-difference px-4 md:px-12 flex items-center justify-between">
        <div className="font-display font-bold text-xl md:text-2xl tracking-tighter text-white pointer-events-auto">
          APPARITIONS
        </div>

        {/* Centre Navigation Links */}
        <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-[40px] text-xs font-bold tracking-[0.2em] pointer-events-auto">
          <button className="text-white font-bold transition-colors duration-300 tracking-[0.2em] focus:outline-none drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] cursor-default">HOME</button>
          <button onClick={() => setGameScene('menu')} className="text-[#555] hover:text-white transition-colors duration-300 tracking-[0.2em] focus:outline-none">GAMES</button>
          <button onClick={() => setGameScene('core')} className="text-[#555] hover:text-white transition-colors duration-300 tracking-[0.2em] focus:outline-none">CORE</button>
          <button onClick={() => setGameScene('nexus')} className="text-[#555] hover:text-white transition-colors duration-300 tracking-[0.2em] focus:outline-none">NEXUS</button>
          <button onClick={() => setGameScene('help')} className="text-[#555] hover:text-white transition-colors duration-300 tracking-[0.2em] focus:outline-none">HELP</button>
        </div>

        {/* Right - Contact / Mobile Menu */}
        <div className="pointer-events-auto flex items-center gap-3">
          <button 
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="md:hidden px-3 py-1.5 border border-white/30 text-white text-[10px] font-mono tracking-widest uppercase hover:bg-white hover:text-black transition-colors"
          >
            {mobileNavOpen ? '✕ CLOSE' : '☰ MENU'}
          </button>
          <button onClick={() => setGameScene('contact')} className="hidden sm:inline-block px-6 py-2 border border-white/20 rounded-full text-xs font-bold uppercase tracking-wider text-white hover:bg-white hover:text-black transition-colors duration-500">
            Contact
          </button>
        </div>
      </nav>

      {/* Mobile Nav Overlay */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="w-full max-w-sm flex flex-col items-start gap-8">
            <div className="border-b border-white/20 pb-4 w-full flex justify-between items-baseline">
              <div>
                <span className="text-[9px] font-mono text-red-500 tracking-[0.3em] uppercase block">SYSTEM TERMINAL</span>
                <h3 className="text-xl font-display font-bold tracking-tighter text-white">APPARITIONS</h3>
              </div>
              <span className="text-[10px] font-mono text-gray-500">v2.6 // SECURE</span>
            </div>

            <div className="flex flex-col gap-5 w-full font-mono text-sm tracking-[0.2em]">
              <button onClick={() => { setGameScene(null); setMobileNavOpen(false); }} className="text-left text-white font-bold flex items-center gap-3 transition-colors group">
                <span className="text-red-500 text-xs font-bold">01</span>
                <span className="text-red-500 group-hover:translate-x-1 transition-transform">HOME ARCHIVE ▶</span>
              </button>
              <button onClick={() => { setGameScene('menu'); setMobileNavOpen(false); }} className="text-left text-gray-400 hover:text-white flex items-center gap-3 transition-colors group">
                <span className="text-red-600 text-xs font-bold">02</span>
                <span className="group-hover:translate-x-1 transition-transform">GAMES COMPENDIUM</span>
              </button>
              <button onClick={() => { setGameScene('core'); setMobileNavOpen(false); }} className="text-left text-gray-400 hover:text-white flex items-center gap-3 transition-colors group">
                <span className="text-red-600 text-xs font-bold">03</span>
                <span className="group-hover:translate-x-1 transition-transform">CORE LESSONS</span>
              </button>
              <button onClick={() => { setGameScene('nexus'); setMobileNavOpen(false); }} className="text-left text-gray-400 hover:text-white flex items-center gap-3 transition-colors group">
                <span className="text-red-600 text-xs font-bold">04</span>
                <span className="group-hover:translate-x-1 transition-transform">3D NEXUS DIORAMA</span>
              </button>
              <button onClick={() => { setGameScene('help'); setMobileNavOpen(false); }} className="text-left text-gray-400 hover:text-white flex items-center gap-3 transition-colors group">
                <span className="text-red-600 text-xs font-bold">05</span>
                <span className="group-hover:translate-x-1 transition-transform">INTELLIGENCE HELP</span>
              </button>
              <button onClick={() => { setGameScene('contact'); setMobileNavOpen(false); }} className="text-left text-gray-400 hover:text-white flex items-center gap-3 transition-colors group">
                <span className="text-red-600 text-xs font-bold">06</span>
                <span className="group-hover:translate-x-1 transition-transform">DISPATCH CONTACT</span>
              </button>
            </div>

            <div className="w-full pt-6 border-t border-white/10 flex justify-between items-center">
              <button
                onClick={() => setMobileNavOpen(false)}
                className="px-6 py-2.5 border border-white/30 text-xs font-mono tracking-[0.2em] text-white hover:bg-white hover:text-black transition-all active:scale-95 uppercase"
              >
                [✕] ESCAPE
              </button>
              <span className="text-[9px] font-mono text-gray-600 tracking-widest">EN-NL IMMERSION</span>
            </div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="relative w-full h-screen flex flex-col items-center justify-center p-8 overflow-hidden">

        {/* Base Title (Behind the Image) */}
        <div className="absolute bottom-[5vh] md:bottom-10 left-4 md:left-12 z-0 pointer-events-none">
          <h1 className="font-display font-bold text-[14vw] md:text-[12vw] leading-[0.8] tracking-tighter text-white">
            APPARITIONS
          </h1>
        </div>

        {/* Hero Interactive Split Image */}
        <div className="relative w-full max-w-lg md:max-w-2xl aspect-[4/5] md:aspect-[4/3] group cursor-pointer transition-transform duration-[2000ms] ease-out scale-[0.8] hover:scale-[0.84] z-10 animate-in fade-in slide-in-from-bottom-10 duration-1000 rounded-lg md:rounded-xl overflow-hidden shadow-2xl">
          <div className="absolute inset-0 bg-[url(/hero.png)] bg-cover bg-center transition-transform duration-[2000ms] group-hover:scale-110" />
          <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-[1px] group-hover:gap-1 transition-all duration-[800ms] ease-[cubic-bezier(0.22,1,0.36,1)]">
            {Object.entries(SCENARIO_DETAILS).map(([key, detail], i) => {
              // Using percentages here squashes if the container isn't square.
              // By wrapping it in overflow-hidden tiles and using a 200% width/height background-size and matching position, we map it correctly.
              const topPos = i < 2 ? '0%' : '100%';
              const leftPos = i % 2 === 0 ? '0%' : '100%';

              return (
                <div
                  key={key}
                  onClick={() => setCurrentScenario(key as ScenarioType)}
                  className="relative w-full h-full overflow-hidden transition-all duration-500 bg-black/50"
                  style={{
                    // Masking technique
                  }}
                >
                  <div
                    className="absolute inset-[0%] transition-transform duration-[2000ms] group-hover:scale-110"
                    style={{
                      width: '200%',
                      height: '200%',
                      top: i > 1 ? '-100%' : '0%',
                      left: i % 2 !== 0 ? '-100%' : '0%',
                      backgroundImage: 'url(/hero.png)',
                      backgroundPosition: 'center',
                      backgroundSize: 'cover'
                    }}
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-700 flex items-center justify-center backdrop-blur-sm">
                    <span className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-editorial-muted text-center px-4">{detail.title}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Overlay Title (Front, frosted translucent effect) */}
        <div className="absolute bottom-[5vh] md:bottom-10 left-4 md:left-12 z-20 pointer-events-none mix-blend-screen">
          <h1 className="font-display font-bold text-[14vw] md:text-[12vw] leading-[0.8] tracking-tighter text-white/40 mix-blend-overlay">
            APPARITIONS
          </h1>
        </div>

        {/* Hero Tiny Narrative */}
        <div className="absolute top-1/2 right-4 md:right-12 -translate-y-1/2 w-48 hidden lg:block text-editorial-muted text-sm font-light leading-relaxed z-30">
          The stylistic barrier between cognitive learning and pure cinematic immersion has fractured. Step into the shadow.
        </div>
      </section>

      {/* Stats Grid */}
      <section className="w-full border-t border-editorial-border relative z-10 bg-editorial-bg">
        <div className="grid grid-cols-2 md:grid-cols-4 px-8 md:px-12 py-12 gap-8">
          {STATS.map((stat, i) => (
            <div key={i} className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-4 duration-700" style={{ animationDelay: `${i * 100}ms`, animationFillMode: 'both' }}>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-editorial-muted">{stat.label}</span>
              <span className="font-display font-medium text-2xl md:text-3xl tracking-wide">{stat.value}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Content Block (Editorial Layout) */}
      <section className="w-full border-t border-editorial-border relative z-10 bg-editorial-bg px-8 md:px-12 pt-32 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-20">
          <div className="md:col-span-4">
            <div className="sticky top-32 flex flex-col gap-12 items-start">
              <h2 className="font-display font-bold text-6xl tracking-tighter">
                COGNITIVE SPACE
              </h2>
              <div className="w-full max-w-sm rounded-[2px] overflow-hidden opacity-90 mix-blend-luminosity grayscale select-none pointer-events-none">
                <img src="/coffee.png" alt="Sketch" className="w-full h-auto object-cover" />
              </div>
            </div>
          </div>
          <div className="md:col-span-8 flex flex-col gap-12 max-w-3xl">
            <p className="text-2xl md:text-3xl font-light leading-[1.6] text-gray-200">
              Language acquisition is rarely a matter of textbook logic. It lives in the unspoken pauses of a dark café, the hushed whispers at a bus stop, the fragments of an overheard story.
            </p>
            <p className="text-xl md:text-2xl font-light leading-[1.6] text-editorial-muted">
              The method is straightforward. We tackle language through active, multimodal engagement, prioritising real speaking and listening over passive study. Apparitions puts you directly inside realistic scenarios and keeps you there until fluency clicks.
            </p>

            <div className="mt-8">
              <a href="#" className="group relative inline-flex items-center gap-4 text-sm font-bold uppercase tracking-[0.2em] pb-2 border-b border-editorial-border hover:border-white transition-colors">
                <span>Get Started</span>
                <span className="transform group-hover:translate-x-2 transition-transform duration-500">→</span>
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default App;
