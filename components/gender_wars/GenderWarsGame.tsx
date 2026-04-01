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

export default function GenderWarsGame() {
  const [screen, setScreen] = useState<ScreenState>('start');
  const [stats, setStats] = useState<GameStats>({ score: 0, missed: [], victory: false });

  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative font-sans text-white overflow-hidden">
      {/* Larger Game Frame with no borders and squared edges, constrained gracefully by Flex parent in App.tsx */}
      <div className="relative z-10 w-full max-w-[1500px] aspect-[16/9] md:aspect-[21/9] max-h-full bg-black rounded-none border-none overflow-hidden mx-auto" style={{ fontFamily: '"Press Start 2P", monospace', userSelect: 'none' }}>
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

        {/* Game Screen Content */}
        <div className="relative w-full h-full">
          {screen === 'start' && <StartScreen onStart={() => setScreen('briefing')} />}
          {screen === 'briefing' && <BriefingScreen onComplete={() => setScreen('game')} />}
          {screen === 'game' && <GameScreen onEnd={(s) => { setStats(s); setScreen('end'); }} onQuit={() => setScreen('start')} />}
          {screen === 'end' && <EndScreen stats={stats} onRestart={() => setScreen('game')} onHome={() => setScreen('start')} />}
        </div>
      </div>
    </div>
  );
}
