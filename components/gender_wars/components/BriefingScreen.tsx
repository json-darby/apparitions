import React, { useEffect, useState } from 'react';

export default function BriefingScreen({ onComplete }: { onComplete: () => void }) {
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowButton(true);
    }, 30000); // Show button after 30 seconds

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Escape' || e.key === 'Enter') {
        onComplete();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onComplete]);

  return (
    <div className="absolute inset-0 bg-black text-white overflow-hidden flex justify-center star-wars-perspective">
      <div className="absolute top-4 right-4 z-50">
        <button onClick={onComplete} className="text-gray-500 hover:text-white text-[10px] uppercase tracking-widest">Skip [Space]</button>
      </div>

      <div className="star-wars-crawl w-full max-w-6xl px-6 text-yellow-400 text-3xl md:text-4xl lg:text-5xl uppercase tracking-[0.2em] leading-[2.5] text-left">
        <p className="mb-16 text-center text-red-600 font-bold">ATTENTION, COMMANDER!</p>
        <p className="mb-16">The Dutch nouns are invading our sector. The masculine and feminine words have formed a massive alliance known as the Common Gender. They are shielded by the article 'DE'.</p>
        <p className="mb-16">Meanwhile, the Neuter words, which belong to neither category, have formed their own rogue faction under the article 'HET'.</p>
        <p className="mb-16">They have grouped together to defeat you and overwhelm our linguistic defences. You must rapidly identify their grammatical gender and blast them with the correct cannon.</p>
        <p className="text-left text-red-600 font-bold">Finish the mission. It is all up to you now. Good luck!</p>
      </div>

      <div className={`absolute bottom-12 z-50 transition-opacity duration-1000 ${showButton ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <button
          onClick={onComplete}
          className="px-8 py-4 bg-red-600 text-white text-2xl font-bold uppercase tracking-widest hover:bg-red-500 transition-colors border-4 border-red-800"
        >
          Start Mission
        </button>
      </div>
    </div>
  );
}
