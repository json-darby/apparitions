/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import StartScreen from './components/StartScreen';
import BriefingScreen from './components/BriefingScreen';
import GameScreen from './components/GameScreen';
import EndScreen from './components/EndScreen';
import { GameStats } from './game/types';

export type ScreenState = 'start' | 'briefing' | 'game' | 'end';

interface GenderWarsGameProps {
  onExit?: () => void;
}

export default function GenderWarsGame({ onExit }: GenderWarsGameProps) {
  const [screen, setScreen] = useState<ScreenState>('start');
  const [stats, setStats] = useState<GameStats>({ score: 0, missed: [], victory: false });

  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative font-sans text-white overflow-hidden">
      {/* Responsive game frame with squared edges and adaptive aspect ratios. */}
      <div className="relative z-10 w-full h-full max-w-[1500px] flex flex-col items-center justify-center bg-black rounded-none border-none overflow-hidden mx-auto touch-none" style={{ fontFamily: '"Press Start 2P", monospace', userSelect: 'none' }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
          
          .star-wars-perspective {
            perspective: 400px;
          }
          
          .star-wars-crawl {
            position: absolute;
            top: 100vh;
            transform-origin: 50% 100%;
            animation: crawl 40s linear forwards;
          }
          
          @keyframes crawl {
            0% {
              transform: rotateX(25deg) translateY(20vh);
              opacity: 1;
            }
            90% {
              opacity: 1;
            }
            100% {
              transform: rotateX(25deg) translateY(-500vh);
              opacity: 0;
            }
          }
        `}</style>

        {/* Active game screen content view. */}
        <div className="relative w-full h-full flex flex-col items-center justify-center">
          {screen === 'start' && <StartScreen onStart={() => setScreen('briefing')} onQuit={onExit} />}
          {screen === 'briefing' && <BriefingScreen onComplete={() => setScreen('game')} />}
          {screen === 'game' && <GameScreen onEnd={(s) => { setStats(s); setScreen('end'); }} onQuit={() => onExit ? onExit() : setScreen('start')} />}
          {screen === 'end' && <EndScreen stats={stats} onRestart={() => setScreen('game')} onHome={() => onExit ? onExit() : setScreen('start')} />}
        </div>
      </div>
    </div>
  );
}
