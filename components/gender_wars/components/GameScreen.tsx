import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine } from '../game/GameEngine';
import { GameStats } from '../game/types';
import HUD from './HUD';

export default function GameScreen({ onEnd, onQuit }: { onEnd: (stats: GameStats) => void, onQuit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const fireIntervalRef = useRef<number | null>(null);
  
  const [hudState, setHudState] = useState({
    score: 0,
    lives: 3,
    level: 0,
    mode: 'de' as const,
    slowActive: false,
    hintActive: false,
    paused: false,
    specialWeaponState: 'ready' as 'ready' | 'charging' | 'firing'
  });

  const [feedback, setFeedback] = useState<{msg: string, color: string, id: number} | null>(null);
  const [bossWarning, setBossWarning] = useState<{msg: string, id: number} | null>(null);
  const [viewportMode, setViewportMode] = useState<'desktop' | 'mobile_portrait' | 'mobile_landscape'>('desktop');

  useEffect(() => {
    if (bossWarning) {
      const timer = setTimeout(() => {
        setBossWarning(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [bossWarning]);

  /** Tracks device orientation, touch capabilities, and responsive viewport mode. */
  useEffect(() => {
    const updateViewportMode = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isCoarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      
      // Responsive detection: active on physical touch/coarse devices or anytime window is resized to mobile/tablet (< 1024px width or < 600px height)
      const isMobileOrTablet = w < 1024 || h < 600 || hasTouch || isCoarse;

      if (!isMobileOrTablet) {
        setViewportMode('desktop');
      } else if (w > h) {
        setViewportMode('mobile_landscape');
      } else {
        setViewportMode('mobile_portrait');
      }
    };

    updateViewportMode();
    window.addEventListener('resize', updateViewportMode);
    window.addEventListener('orientationchange', updateViewportMode);
    return () => {
      window.removeEventListener('resize', updateViewportMode);
      window.removeEventListener('orientationchange', updateViewportMode);
    };
  }, []);

  /** Manages canvas dimensions, coordinate scaling, and entity bounds upon initialisation and resize. */
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isCoarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      const isMobileOrTablet = w < 1024 || h < 600 || hasTouch || isCoarse;

      if (isMobileOrTablet && w <= h) {
        // Mobile portrait: fixed 16:9 virtual resolution ensures words have ample flight runway
        canvas.width = 960;
        canvas.height = 540;
      } else if (canvas.parentElement) {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
      } else {
        canvas.width = w;
        canvas.height = h;
      }

      // Constrains vessel position within the active display bounds
      if (engineRef.current && engineRef.current.ship) {
        const ship = engineRef.current.ship;
        ship.x = Math.max(30, Math.min(ship.x, canvas.width * 0.45));
        ship.y = Math.max(30, Math.min(ship.y, canvas.height - 30));
      }
    };

    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);
    resize();

    const engine = new GameEngine(
      canvas,
      setHudState,
      onEnd,
      (msg, color) => setFeedback({ msg, color, id: Date.now() }),
      (msg) => setBossWarning({ msg, id: Date.now() })
    );
    
    engineRef.current = engine;
    engine.start();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', resize);
      if (fireIntervalRef.current) clearInterval(fireIntervalRef.current);
      engine.stop();
    };
  }, [onEnd]);

  /** Translates touchscreen drag gestures into canvas coordinates for vessel steering. */
  const handleTouchSteer = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!engineRef.current || !canvasRef.current) return;
    const touch = e.touches[0];
    if (!touch) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const touchX = (touch.clientX - rect.left) * scaleX;
    const touchY = (touch.clientY - rect.top) * scaleY;

    const ship = engineRef.current.ship;
    if (ship) {
      ship.x = Math.max(20, Math.min(canvasRef.current.width * 0.45, touchX));
      ship.y = Math.max(20, Math.min(canvasRef.current.height - 20, touchY));
    }
  }, []);

  /** Toggles between the 'DE' and 'HET' article cannon modes. */
  const handleToggleMode = () => {
    if (!engineRef.current) return;
    const nextMode = hudState.mode === 'de' ? 'het' : 'de';
    engineRef.current.ship.switchTo(nextMode);
    setHudState(prev => ({ ...prev, mode: nextMode }));
  };

  /** Initiates continuous auto-fire cycles when the trigger is held. */
  const handleStartFiring = (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    if (!engineRef.current || engineRef.current.paused) return;
    engineRef.current.fireBullet();

    if (!fireIntervalRef.current) {
      fireIntervalRef.current = window.setInterval(() => {
        if (engineRef.current && !engineRef.current.paused) {
          engineRef.current.fireBullet();
        }
      }, 130);
    }
  };

  /** Terminates the continuous auto-fire interval upon trigger release. */
  const handleStopFiring = () => {
    if (fireIntervalRef.current) {
      clearInterval(fireIntervalRef.current);
      fireIntervalRef.current = null;
    }
  };

  const handleSetKey = (key: 'up' | 'down' | 'left' | 'right', pressed: boolean) => {
    if (engineRef.current) {
      engineRef.current.keys[key] = pressed;
    }
  };

  const isDe = hudState.mode === 'de';

  return (
    <div className={`w-full h-full select-none touch-none ${
      viewportMode === 'mobile_portrait'
        ? 'flex flex-col items-center justify-between p-1 bg-black overflow-hidden'
        : viewportMode === 'mobile_landscape'
        ? 'relative bg-black overflow-hidden flex flex-col w-full h-full'
        : 'relative bg-black max-w-[1500px] aspect-[21/9] border border-white/20 mx-auto my-auto shadow-2xl flex flex-col overflow-hidden'
    }`}>
      
      {/* Universal HUD Bar */}
      <HUD 
        state={hudState} 
        onPauseToggle={() => engineRef.current?.togglePause()} 
        onSpecialWeapon={() => engineRef.current?.activateSpecialWeapon()}
        onToggleMode={handleToggleMode}
        onQuit={onQuit}
      />
      
      {/* Arcade Monitor Screen Container (Holds Canvas & In-Game Overlays) */}
      <div className={`relative overflow-hidden ${
        viewportMode === 'mobile_portrait'
          ? 'w-full max-w-[480px] aspect-[16/9] border border-white/25 bg-black shadow-[0_0_35px_rgba(0,0,0,0.9)] shrink-0'
          : 'flex-1 w-full h-full'
      }`}>
        <canvas 
          ref={canvasRef} 
          onTouchStart={viewportMode !== 'desktop' ? handleTouchSteer : undefined}
          onTouchMove={viewportMode !== 'desktop' ? handleTouchSteer : undefined}
          className="block w-full h-full touch-none" 
        />

        {/* System Pause Overlay */}
        {hudState.paused && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center z-50 animate-in fade-in duration-200">
            <h2 className="text-2xl md:text-4xl text-white mb-2 tracking-[0.3em] font-mono font-bold">SYSTEM // PAUSED</h2>
            <div className="w-16 h-[2px] bg-red-600 mb-6 md:mb-8" />
            <div className="flex flex-col gap-3 md:gap-4 w-56 md:w-64">
              <button 
                onClick={() => engineRef.current?.togglePause()}
                className="w-full py-3 bg-white text-black hover:bg-gray-200 active:scale-95 transition-all text-xs md:text-sm font-mono font-bold uppercase tracking-[0.2em] border border-white"
              >
                Resume Flight
              </button>
              <button 
                onClick={() => {
                  engineRef.current?.stop();
                  onQuit();
                }}
                className="w-full py-3 bg-transparent border border-red-600/60 text-red-500 hover:bg-red-600 hover:text-white active:scale-95 transition-all text-xs md:text-sm font-mono font-bold uppercase tracking-[0.2em]"
              >
                Abort Mission
              </button>
            </div>
          </div>
        )}

        {/* Feedback Ping Message */}
        {feedback && (
          <div 
            key={feedback.id}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-lg md:text-2xl pointer-events-none animate-[ping_0.5s_ease-out_forwards] font-mono font-black tracking-widest drop-shadow-[0_0_12px_rgba(255,255,255,0.5)]"
            style={{ color: feedback.color }}
          >
            {feedback.msg}
          </div>
        )}

        {/* Boss Warning Banner */}
        {bossWarning && (
          <div 
            key={`boss-${bossWarning.id}`}
            className="absolute top-1/3 left-1/2 -translate-x-1/2 text-lg md:text-3xl text-red-500 text-center pointer-events-none animate-pulse whitespace-pre-line leading-loose font-mono font-black tracking-[0.25em] drop-shadow-[0_0_20px_rgba(239,68,68,0.8)]"
          >
            {bossWarning.msg}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* PORTRAIT MODE: Tactile Brutalist Cyberdeck Console Deck         */}
      {/* ------------------------------------------------------------- */}
      {viewportMode === 'mobile_portrait' && (
        <div className="flex-1 w-full max-w-[480px] mt-1.5 bg-[#08080a] border border-white/20 p-2 sm:p-3 flex flex-col justify-between shadow-2xl overflow-hidden select-none">
          {/* Deck Header / Status Strip */}
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5 mb-1.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse shadow-[0_0_8px_#FF0000]" />
              <span className="text-[9px] font-mono font-bold tracking-[0.2em] text-white/90 uppercase">
                CYBERDECK 16:9
              </span>
            </div>
            <div className="text-[8px] font-mono text-gray-400 tracking-wider flex items-center gap-1">
              <span>⟲</span>
              <span className="animate-pulse text-gray-300">ROTATE FOR FULLSCREEN</span>
            </div>
          </div>

          {/* Main Controls Deck: Left D-Pad | Centre Telemetry | Right Action Cluster */}
          <div className="flex items-center justify-between gap-1 sm:gap-3 my-auto">
            {/* Left: Tactile D-Pad */}
            <div className="grid grid-cols-3 gap-1 w-32 h-32 sm:w-36 sm:h-36 bg-[#0c0c10] p-1 border border-white/15 shadow-xl shrink-0">
              <div />
              <button
                onTouchStart={() => handleSetKey('up', true)}
                onTouchEnd={() => handleSetKey('up', false)}
                onMouseDown={() => handleSetKey('up', true)}
                onMouseUp={() => handleSetKey('up', false)}
                className="bg-[#18181c] active:bg-white active:text-black border border-white/20 text-white flex items-center justify-center text-sm font-mono font-bold shadow active:scale-95 transition-all"
                aria-label="Up"
              >
                ▲
              </button>
              <div />
              <button
                onTouchStart={() => handleSetKey('left', true)}
                onTouchEnd={() => handleSetKey('left', false)}
                onMouseDown={() => handleSetKey('left', true)}
                onMouseUp={() => handleSetKey('left', false)}
                className="bg-[#18181c] active:bg-white active:text-black border border-white/20 text-white flex items-center justify-center text-sm font-mono font-bold shadow active:scale-95 transition-all"
                aria-label="Left"
              >
                ◄
              </button>
              <button
                onClick={() => engineRef.current?.ship.toggleFacing()}
                className="bg-[#0e0e12] active:bg-red-600 border border-white/15 text-gray-400 active:text-white flex flex-col items-center justify-center text-[7px] font-mono font-bold tracking-tighter uppercase transition-colors"
                title="Flip ship facing direction"
              >
                <span>⇄</span>
                <span>FLIP</span>
              </button>
              <button
                onTouchStart={() => handleSetKey('right', true)}
                onTouchEnd={() => handleSetKey('right', false)}
                onMouseDown={() => handleSetKey('right', true)}
                onMouseUp={() => handleSetKey('right', false)}
                className="bg-[#18181c] active:bg-white active:text-black border border-white/20 text-white flex items-center justify-center text-sm font-mono font-bold shadow active:scale-95 transition-all"
                aria-label="Right"
              >
                ►
              </button>
              <div />
              <button
                onTouchStart={() => handleSetKey('down', true)}
                onTouchEnd={() => handleSetKey('down', false)}
                onMouseDown={() => handleSetKey('down', true)}
                onMouseUp={() => handleSetKey('down', false)}
                className="bg-[#18181c] active:bg-white active:text-black border border-white/20 text-white flex items-center justify-center text-sm font-mono font-bold shadow active:scale-95 transition-all"
                aria-label="Down"
              >
                ▼
              </button>
              <div />
            </div>

            {/* Center: Tactical Telemetry & Quick Article Mode Switch */}
            <div className="flex flex-col items-center justify-center gap-1.5 px-1 shrink-0">
              <div className="text-[7px] sm:text-[8px] font-mono text-gray-500 tracking-widest uppercase text-center">
                ACTIVE MODE
              </div>
              <button
                onClick={handleToggleMode}
                className={`w-14 sm:w-16 py-2 border flex flex-col items-center justify-center font-mono font-black tracking-wider transition-all uppercase shadow-lg active:scale-95 ${
                  isDe
                    ? 'bg-red-600 border-red-500 text-white shadow-[0_0_16px_rgba(239,68,68,0.7)]'
                    : 'bg-white border-white text-black shadow-[0_0_16px_rgba(255,255,255,0.6)]'
                }`}
                title="Switch DE / HET mode"
              >
                <span className="text-[7px] opacity-75 font-sans font-bold">ARTICLE</span>
                <span className="text-base sm:text-lg leading-none mt-0.5">{isDe ? 'DE' : 'HET'}</span>
              </button>
              <div className="w-8 h-[1px] bg-white/20 my-0.5" />
              <div className="text-[6px] sm:text-[7px] font-mono text-gray-400 tracking-tighter text-center">
                HOLD FOR AUTO
              </div>
            </div>

            {/* Right: Actions Cluster (Superweapon Beam + Primary Cannon) */}
            <div className="flex flex-col items-end gap-1.5 sm:gap-2 shrink-0">
              {/* Divergent Beam Superweapon Trigger */}
              <button
                onClick={() => engineRef.current?.activateSpecialWeapon()}
                disabled={hudState.specialWeaponState !== 'ready' || hudState.lives <= 0}
                className={`w-20 sm:w-24 py-1 border flex items-center justify-center gap-1 text-[8px] font-mono font-bold uppercase transition-all shadow-md active:scale-95 ${
                  hudState.specialWeaponState === 'ready'
                    ? 'bg-cyan-950/90 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.4)] active:bg-cyan-400 active:text-black'
                    : 'bg-[#09090b]/80 border-gray-800 text-gray-700 opacity-40'
                }`}
                title="Fire Divergent Beam"
              >
                <span>⚡</span>
                <span className="tracking-widest">BEAM [R]</span>
              </button>

              {/* Primary Arc Cannon Trigger [FIRE] */}
              <button
                onTouchStart={handleStartFiring}
                onTouchEnd={handleStopFiring}
                onMouseDown={handleStartFiring}
                onMouseUp={handleStopFiring}
                onMouseLeave={handleStopFiring}
                className="w-20 h-20 sm:w-24 sm:h-24 bg-white active:bg-red-600 text-black active:text-white border-2 border-white flex flex-col items-center justify-center font-mono uppercase transition-all duration-75 shadow-[0_0_25px_rgba(255,255,255,0.4)] active:shadow-[0_0_35px_rgba(239,68,68,0.9)] active:scale-95"
                title="Hold or Tap to blast targets"
              >
                <span className="text-lg sm:text-xl font-black tracking-widest leading-none">FIRE</span>
                <span className="text-[7px] sm:text-[8px] tracking-[0.2em] opacity-60 font-bold mt-1">AUTO</span>
              </button>
            </div>
          </div>

          {/* Console Telemetry Footer */}
          <div className="pt-1.5 border-t border-white/10 flex justify-between items-center text-[7px] font-mono text-gray-500">
            <span>DEFENCE SYSTEMS // ACTIVE</span>
            <span className="text-red-500 font-bold">APPARITIONS v2.4</span>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* LANDSCAPE MODE: Floating Edge Controls on Full Screen Canvas   */}
      {/* ------------------------------------------------------------- */}
      {viewportMode === 'mobile_landscape' && (
        <div className="absolute bottom-2 inset-x-2 flex justify-between items-end pointer-events-none z-40">
          {/* Bottom-Left: Compact Frosted D-Pad */}
          <div className="pointer-events-auto grid grid-cols-3 gap-1 w-28 h-28 bg-[#09090b]/80 backdrop-blur-md p-1 border border-white/15 shadow-2xl">
            <div />
            <button
              onTouchStart={() => handleSetKey('up', true)}
              onTouchEnd={() => handleSetKey('up', false)}
              onMouseDown={() => handleSetKey('up', true)}
              onMouseUp={() => handleSetKey('up', false)}
              className="bg-[#151518] active:bg-white active:text-black border border-white/20 text-white flex items-center justify-center text-xs font-mono font-bold shadow active:scale-95"
              aria-label="Up"
            >
              ▲
            </button>
            <div />
            <button
              onTouchStart={() => handleSetKey('left', true)}
              onTouchEnd={() => handleSetKey('left', false)}
              onMouseDown={() => handleSetKey('left', true)}
              onMouseUp={() => handleSetKey('left', false)}
              className="bg-[#151518] active:bg-white active:text-black border border-white/20 text-white flex items-center justify-center text-xs font-mono font-bold shadow active:scale-95"
              aria-label="Left"
            >
              ◄
            </button>
            <button
              onClick={() => engineRef.current?.ship.toggleFacing()}
              className="bg-[#0e0e11] active:bg-red-600 border border-white/10 text-gray-400 active:text-white flex flex-col items-center justify-center text-[6px] font-mono tracking-tighter uppercase"
              title="Flip ship"
            >
              <span>⇄</span>
              <span>FLIP</span>
            </button>
            <button
              onTouchStart={() => handleSetKey('right', true)}
              onTouchEnd={() => handleSetKey('right', false)}
              onMouseDown={() => handleSetKey('right', true)}
              onMouseUp={() => handleSetKey('right', false)}
              className="bg-[#151518] active:bg-white active:text-black border border-white/20 text-white flex items-center justify-center text-xs font-mono font-bold shadow active:scale-95"
              aria-label="Right"
            >
              ►
            </button>
            <div />
            <button
              onTouchStart={() => handleSetKey('down', true)}
              onTouchEnd={() => handleSetKey('down', false)}
              onMouseDown={() => handleSetKey('down', true)}
              onMouseUp={() => handleSetKey('down', false)}
              className="bg-[#151518] active:bg-white active:text-black border border-white/20 text-white flex items-center justify-center text-xs font-mono font-bold shadow active:scale-95"
              aria-label="Down"
            >
              ▼
            </button>
            <div />
          </div>

          {/* Bottom-Right: Compact Frosted Action Buttons */}
          <div className="pointer-events-auto flex items-end gap-1.5">
            {/* Beam Superweapon */}
            <button
              onClick={() => engineRef.current?.activateSpecialWeapon()}
              disabled={hudState.specialWeaponState !== 'ready' || hudState.lives <= 0}
              className={`w-12 h-12 border flex flex-col items-center justify-center text-[7px] font-mono font-bold uppercase transition-all shadow-lg active:scale-95 ${
                hudState.specialWeaponState === 'ready'
                  ? 'bg-cyan-950/80 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.4)] active:bg-cyan-400 active:text-black'
                  : 'bg-[#09090b]/80 border-gray-800 text-gray-700 opacity-40'
              }`}
            >
              <span className="text-xs">⚡</span>
              <span>BEAM</span>
            </button>

            {/* DE / HET Switcher */}
            <button
              onClick={handleToggleMode}
              className={`w-14 h-14 border-2 flex flex-col items-center justify-center font-mono uppercase transition-all duration-150 shadow-xl active:scale-95 ${
                isDe 
                  ? 'bg-gradient-to-b from-red-600 to-red-700 border-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.5)]' 
                  : 'bg-gradient-to-b from-white to-gray-200 border-white text-black shadow-[0_0_20px_rgba(255,255,255,0.4)]'
              }`}
            >
              <span className="text-[7px] tracking-wider opacity-75 font-sans font-bold">CANNON</span>
              <span className="text-base font-black tracking-wider leading-none mt-0.5">{isDe ? 'DE' : 'HET'}</span>
            </button>

            {/* Primary Cannon Trigger */}
            <button
              onTouchStart={handleStartFiring}
              onTouchEnd={handleStopFiring}
              onMouseDown={handleStartFiring}
              onMouseUp={handleStopFiring}
              onMouseLeave={handleStopFiring}
              className="w-16 h-16 bg-white active:bg-red-600 text-black active:text-white border-2 border-white flex flex-col items-center justify-center font-mono uppercase transition-all duration-75 shadow-[0_0_25px_rgba(255,255,255,0.3)] active:shadow-[0_0_30px_rgba(239,68,68,0.8)] active:scale-95"
            >
              <span className="text-sm font-black tracking-widest leading-none">FIRE</span>
              <span className="text-[6px] tracking-wider opacity-60 font-bold mt-0.5">AUTO</span>
            </button>
          </div>
        </div>
      )}

      {/* NOTE: Desktop mode renders ZERO touch buttons, preserving keyboard mastery */}
    </div>
  );
}
