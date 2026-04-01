import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../game/GameEngine';
import { GameStats } from '../game/types';
import HUD from './HUD';

export default function GameScreen({ onEnd, onQuit }: { onEnd: (stats: GameStats) => void, onQuit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  
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

  useEffect(() => {
    if (bossWarning) {
      const timer = setTimeout(() => {
        setBossWarning(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [bossWarning]);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const resize = () => {
      if (canvas.parentElement) {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
      } else {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', resize);
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
      engine.stop();
    };
  }, [onEnd]);

  return (
    <div className="absolute inset-0 bg-black flex flex-col">
      <HUD 
        state={hudState} 
        onPauseToggle={() => engineRef.current?.togglePause()} 
        onSpecialWeapon={() => engineRef.current?.activateSpecialWeapon()}
      />
      
      <div className="flex-1 relative overflow-hidden">
        <canvas ref={canvasRef} className="block w-full h-full" />

        {hudState.paused && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-50">
            <h2 className="text-4xl text-white mb-8">PAUSED</h2>
            <div className="flex flex-col gap-4">
              <button 
                onClick={() => engineRef.current?.togglePause()}
                className="px-8 py-3 bg-white text-black hover:bg-gray-200 transition-colors text-xl"
              >
                Resume
              </button>
              <button 
                onClick={() => {
                  engineRef.current?.stop();
                  onQuit();
                }}
                className="px-8 py-3 border-2 border-red-600 text-red-600 hover:bg-red-600 hover:text-white transition-colors text-xl"
              >
                Quit Mission
              </button>
            </div>
          </div>
        )}

        {feedback && (
          <div 
            key={feedback.id}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xl pointer-events-none animate-[ping_0.5s_ease-out_forwards]"
            style={{ color: feedback.color }}
          >
            {feedback.msg}
          </div>
        )}

        {bossWarning && (
          <div 
            key={`boss-${bossWarning.id}`}
            className="absolute top-1/3 left-1/2 -translate-x-1/2 text-2xl text-red-600 text-center pointer-events-none animate-pulse whitespace-pre-line leading-loose"
          >
            {bossWarning.msg}
          </div>
        )}
      </div>
    </div>
  );
}
