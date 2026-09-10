import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { GameEngine } from '../game/GameEngine';
import { GameStats } from '../game/types';
import HUD from './HUD';
import MovementControl, { SchemeToggle } from './controls/MovementControl';
import { CONTROL_SCHEME_STORAGE_KEY, ControlScheme, Direction } from './controls/types';

type ViewportMode = 'desktop' | 'mobile_portrait' | 'mobile_landscape';

/**
 * Fixed virtual resolution used on every touch device. Locking the playfield to a
 * real 16:9 means words always have the same flight runway, and — crucially in
 * landscape — the picture is letterboxed to fit rather than stretched to the
 * phone's much wider screen.
 */
const VIRTUAL_WIDTH = 960;
const VIRTUAL_HEIGHT = 540;

const AUTO_FIRE_INTERVAL_MS = 130;

function detectViewportMode(): ViewportMode {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isCoarse = window.matchMedia ? window.matchMedia('(pointer: coarse)').matches : false;

  /* Touch/coarse devices always get the arcade console; so do desktop windows
     resized down to phone or tablet proportions. */
  const isMobileOrTablet = w < 1024 || h < 600 || hasTouch || isCoarse;
  if (!isMobileOrTablet) return 'desktop';
  return w > h ? 'mobile_landscape' : 'mobile_portrait';
}

/**
 * Measures a container and returns the largest box of `ratio` that fits inside it.
 * Used to letterbox the landscape playfield: CSS alone cannot fit a box to *both*
 * axes of its parent without either overflowing or breaking the aspect ratio.
 */
function useFittedBox(enabled: boolean, ratio: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useLayoutEffect(() => {
    if (!enabled) {
      setSize(null);
      return;
    }
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w <= 0 || h <= 0) return;
      const width = Math.floor(Math.min(w, h * ratio));
      setSize({ width, height: Math.floor(width / ratio) });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled, ratio]);

  return { ref, size };
}

function loadControlScheme(): ControlScheme {
  try {
    return localStorage.getItem(CONTROL_SCHEME_STORAGE_KEY) === 'stick' ? 'stick' : 'dpad';
  } catch {
    return 'dpad';
  }
}

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

  const [feedback, setFeedback] = useState<{ msg: string, color: string, id: number } | null>(null);
  const [bossWarning, setBossWarning] = useState<{ msg: string, id: number } | null>(null);
  const [viewportMode, setViewportMode] = useState<ViewportMode>('desktop');
  const [controlScheme, setControlScheme] = useState<ControlScheme>(loadControlScheme);

  const isLandscape = viewportMode === 'mobile_landscape';
  const { ref: stageRef, size: fittedSize } = useFittedBox(isLandscape, VIRTUAL_WIDTH / VIRTUAL_HEIGHT);

  useEffect(() => {
    if (bossWarning) {
      const timer = setTimeout(() => setBossWarning(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [bossWarning]);

  /** Remember the player's control preference between sessions. */
  const handleSchemeChange = useCallback((scheme: ControlScheme) => {
    setControlScheme(scheme);
    /* Releasing whichever control is being swapped away prevents a stuck input. */
    if (engineRef.current) {
      engineRef.current.keys = { up: false, down: false, left: false, right: false };
      engineRef.current.axis = { x: 0, y: 0 };
    }
    try {
      localStorage.setItem(CONTROL_SCHEME_STORAGE_KEY, scheme);
    } catch {
      /* Private mode / storage disabled — the preference just won't persist. */
    }
  }, []);

  /** Tracks device orientation and responsive viewport mode. */
  useEffect(() => {
    const update = () => setViewportMode(detectViewportMode());
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  /** Manages canvas resolution and entity bounds on mount and on resize. */
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;

    const resize = () => {
      if (detectViewportMode() === 'desktop' && canvas.parentElement) {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
      } else {
        canvas.width = VIRTUAL_WIDTH;
        canvas.height = VIRTUAL_HEIGHT;
      }

      /* Keep the vessel inside the new bounds. */
      const ship = engineRef.current?.ship;
      if (ship) {
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

  /** Translates touchscreen drag gestures on the canvas into vessel steering. */
  const handleTouchSteer = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ship = engineRef.current?.ship;
    const touch = e.touches[0];
    if (!canvas || !ship || !touch) return;

    const rect = canvas.getBoundingClientRect();
    const touchX = (touch.clientX - rect.left) * (canvas.width / rect.width);
    const touchY = (touch.clientY - rect.top) * (canvas.height / rect.height);

    ship.x = Math.max(20, Math.min(canvas.width * 0.45, touchX));
    ship.y = Math.max(20, Math.min(canvas.height - 20, touchY));
  }, []);

  /** Toggles between the 'DE' and 'HET' article cannon modes. */
  const handleToggleMode = useCallback(() => {
    if (!engineRef.current) return;
    const nextMode = engineRef.current.ship.mode === 'de' ? 'het' : 'de';
    engineRef.current.ship.switchTo(nextMode);
    setHudState(prev => ({ ...prev, mode: nextMode }));
  }, []);

  const handleFlip = useCallback(() => engineRef.current?.ship.toggleFacing(), []);
  const handleSpecialWeapon = useCallback(() => engineRef.current?.activateSpecialWeapon(), []);

  /** Initiates continuous auto-fire cycles when the trigger is held. */
  const handleStartFiring = useCallback((e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    if (!engineRef.current || engineRef.current.paused) return;
    engineRef.current.fireBullet();

    if (!fireIntervalRef.current) {
      fireIntervalRef.current = window.setInterval(() => {
        if (engineRef.current && !engineRef.current.paused) {
          engineRef.current.fireBullet();
        }
      }, AUTO_FIRE_INTERVAL_MS);
    }
  }, []);

  /** Terminates the continuous auto-fire interval upon trigger release. */
  const handleStopFiring = useCallback(() => {
    if (fireIntervalRef.current) {
      clearInterval(fireIntervalRef.current);
      fireIntervalRef.current = null;
    }
  }, []);

  const handleDirection = useCallback((dir: Direction, pressed: boolean) => {
    if (engineRef.current) engineRef.current.keys[dir] = pressed;
  }, []);

  const handleAxis = useCallback((x: number, y: number) => {
    if (engineRef.current) engineRef.current.axis = { x, y };
  }, []);

  const isDe = hudState.mode === 'de';
  const isTouchLayout = viewportMode !== 'desktop';

  /* ---------------------------------------------------------------- pieces -- */

  const flipButton = (compact: boolean) => (
    <button
      onClick={handleFlip}
      className={`${compact ? 'w-14 py-1 text-[7px]' : 'w-14 sm:w-16 py-1.5 text-[8px]'} bg-[#0e0e12] active:bg-red-600 border border-white/15 text-gray-400 active:text-white flex items-center justify-center gap-1 font-mono font-bold tracking-tighter uppercase transition-colors`}
      title="Flip ship facing direction"
    >
      <span>⇄</span>
      <span>FLIP</span>
    </button>
  );

  const articleButton = (compact: boolean) => (
    <button
      onClick={handleToggleMode}
      className={`${compact ? 'w-14 h-14' : 'w-14 sm:w-16 py-2'} border-2 flex flex-col items-center justify-center font-mono font-black tracking-wider transition-all uppercase shadow-lg active:scale-95 ${
        isDe
          ? 'bg-red-600 border-red-500 text-white shadow-[0_0_16px_rgba(239,68,68,0.7)]'
          : 'bg-white border-white text-black shadow-[0_0_16px_rgba(255,255,255,0.6)]'
      }`}
      title="Switch DE / HET mode"
    >
      <span className="text-[7px] opacity-75 font-sans font-bold">{compact ? 'CANNON' : 'ARTICLE'}</span>
      <span className={`${compact ? 'text-base' : 'text-base sm:text-lg'} leading-none mt-0.5`}>{isDe ? 'DE' : 'HET'}</span>
    </button>
  );

  const beamButton = (compact: boolean) => (
    <button
      onClick={handleSpecialWeapon}
      disabled={hudState.specialWeaponState !== 'ready' || hudState.lives <= 0}
      className={`${compact ? 'w-12 h-12 flex-col text-[7px]' : 'w-20 sm:w-24 py-1 text-[8px]'} border flex items-center justify-center gap-1 font-mono font-bold uppercase transition-all shadow-md active:scale-95 ${
        hudState.specialWeaponState === 'ready'
          ? 'bg-cyan-950/90 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.4)] active:bg-cyan-400 active:text-black'
          : 'bg-[#09090b]/80 border-gray-800 text-gray-700 opacity-40'
      }`}
      title="Fire Divergent Beam"
    >
      <span className={compact ? 'text-xs' : ''}>⚡</span>
      <span className="tracking-widest">{compact ? 'BEAM' : 'BEAM [R]'}</span>
    </button>
  );

  const fireButton = (compact: boolean) => (
    <button
      onTouchStart={handleStartFiring}
      onTouchEnd={handleStopFiring}
      onTouchCancel={handleStopFiring}
      onMouseDown={handleStartFiring}
      onMouseUp={handleStopFiring}
      onMouseLeave={handleStopFiring}
      className={`${compact ? 'w-16 h-16' : 'w-20 h-20 sm:w-24 sm:h-24'} bg-white active:bg-red-600 text-black active:text-white border-2 border-white flex flex-col items-center justify-center font-mono uppercase transition-all duration-75 shadow-[0_0_25px_rgba(255,255,255,0.35)] active:shadow-[0_0_35px_rgba(239,68,68,0.9)] active:scale-95 touch-none`}
      title="Hold or tap to blast targets"
    >
      <span className={`${compact ? 'text-sm' : 'text-lg sm:text-xl'} font-black tracking-widest leading-none`}>FIRE</span>
      <span className={`${compact ? 'text-[6px] mt-0.5' : 'text-[7px] sm:text-[8px] mt-1'} tracking-[0.2em] opacity-60 font-bold`}>AUTO</span>
    </button>
  );

  const movement = (compact: boolean) => (
    <MovementControl
      scheme={controlScheme}
      onDirection={handleDirection}
      onAxis={handleAxis}
      sizeClass={compact ? 'w-28 h-28' : 'w-32 h-32 sm:w-36 sm:h-36'}
      variant={compact ? 'floating' : 'deck'}
    />
  );

  /* ---------------------------------------------------------------- layout -- */

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
        onSpecialWeapon={handleSpecialWeapon}
        onToggleMode={handleToggleMode}
        onQuit={onQuit}
      />

      {/* Arcade monitor. On touch devices the playfield keeps its true 16:9 shape:
          portrait pins it to the top of the deck, landscape letterboxes it into
          whatever space is left rather than stretching it across the phone. */}
      <div
        ref={stageRef}
        className={
          isLandscape
            ? 'relative flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden'
            : viewportMode === 'mobile_portrait'
            ? 'relative w-full max-w-[480px] shrink-0'
            : 'relative flex-1 w-full h-full overflow-hidden'
        }
      >
        <div
          className={`relative overflow-hidden ${
            isTouchLayout
              ? 'border border-white/25 bg-black shadow-[0_0_35px_rgba(0,0,0,0.9)]'
              : 'w-full h-full'
          } ${viewportMode === 'mobile_portrait' ? 'w-full aspect-[16/9]' : ''}`}
          style={isLandscape && fittedSize ? { width: fittedSize.width, height: fittedSize.height } : undefined}
        >
          <canvas
            ref={canvasRef}
            onTouchStart={isTouchLayout ? handleTouchSteer : undefined}
            onTouchMove={isTouchLayout ? handleTouchSteer : undefined}
            className="block w-full h-full touch-none"
          />

          {/* System Pause Overlay */}
          {hudState.paused && (
            <div className="absolute inset-0 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center z-50 animate-in fade-in duration-200 px-4">
              <h2 className="text-lg sm:text-2xl md:text-4xl text-white mb-2 tracking-[0.2em] sm:tracking-[0.3em] font-mono font-bold text-center">SYSTEM // PAUSED</h2>
              <div className="w-16 h-[2px] bg-red-600 mb-4 sm:mb-8" />
              <div className="flex flex-col gap-2.5 sm:gap-4 w-48 sm:w-64">
                <button
                  onClick={() => engineRef.current?.togglePause()}
                  className="w-full py-2.5 sm:py-3 bg-white text-black hover:bg-gray-200 active:scale-95 transition-all text-[10px] sm:text-sm font-mono font-bold uppercase tracking-[0.2em] border border-white"
                >
                  Resume Flight
                </button>
                <button
                  onClick={() => { engineRef.current?.stop(); onQuit(); }}
                  className="w-full py-2.5 sm:py-3 bg-transparent border border-red-600/60 text-red-500 hover:bg-red-600 hover:text-white active:scale-95 transition-all text-[10px] sm:text-sm font-mono font-bold uppercase tracking-[0.2em]"
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
      </div>

      {/* ------------------------------------------------------------- */}
      {/* PORTRAIT MODE: Tactile Brutalist Cyberdeck Console Deck        */}
      {/* ------------------------------------------------------------- */}
      {viewportMode === 'mobile_portrait' && (
        <div className="flex-1 w-full max-w-[480px] mt-1.5 bg-[#08080a] border border-white/20 p-2 sm:p-3 flex flex-col justify-between shadow-2xl overflow-hidden select-none">
          {/* Deck Header / Status Strip */}
          <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-1.5 mb-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse shadow-[0_0_8px_#FF0000] shrink-0" />
              <span className="text-[9px] font-mono font-bold tracking-[0.2em] text-white/90 uppercase truncate">
                CYBERDECK 16:9
              </span>
            </div>
            <SchemeToggle scheme={controlScheme} onChange={handleSchemeChange} className="shrink-0" />
          </div>

          {/* Main Controls Deck: Movement | Article + Flip | Beam + Fire */}
          <div className="flex items-center justify-between gap-1 sm:gap-3 my-auto">
            {movement(false)}

            {/* Centre: article mode with FLIP stacked directly beneath it */}
            <div className="flex flex-col items-center justify-center gap-1.5 px-1 shrink-0">
              <div className="text-[7px] sm:text-[8px] font-mono text-gray-500 tracking-widest uppercase text-center">
                ACTIVE MODE
              </div>
              {articleButton(false)}
              {flipButton(false)}
            </div>

            {/* Right: Actions Cluster (Superweapon Beam + Primary Cannon) */}
            <div className="flex flex-col items-end gap-1.5 sm:gap-2 shrink-0">
              {beamButton(false)}
              {fireButton(false)}
            </div>
          </div>

          {/* Console Telemetry Footer */}
          <div className="pt-1.5 border-t border-white/10 flex justify-between items-center text-[7px] font-mono text-gray-500">
            <span className="flex items-center gap-1"><span>⟲</span> ROTATE FOR FULLSCREEN</span>
            <span className="text-red-500 font-bold">APPARITIONS v2.4</span>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* LANDSCAPE MODE: Floating edge controls over the letterboxed    */}
      {/* playfield, so the black bars carry the console instead of      */}
      {/* stealing space from the picture.                              */}
      {/* ------------------------------------------------------------- */}
      {viewportMode === 'mobile_landscape' && (
        <div className="absolute bottom-2 inset-x-2 flex justify-between items-end pointer-events-none z-40 gap-2">
          {/* Bottom-left: movement + its scheme switch */}
          <div className="pointer-events-auto flex flex-col items-start gap-1.5">
            <SchemeToggle scheme={controlScheme} onChange={handleSchemeChange} />
            {movement(true)}
          </div>

          {/* Bottom-right: beam, article (with FLIP beneath it), fire */}
          <div className="pointer-events-auto flex items-end gap-1.5">
            {beamButton(true)}
            <div className="flex flex-col items-center gap-1.5">
              {articleButton(true)}
              {flipButton(true)}
            </div>
            {fireButton(true)}
          </div>
        </div>
      )}

      {/* NOTE: Desktop mode renders ZERO touch buttons, preserving keyboard mastery */}
    </div>
  );
}
