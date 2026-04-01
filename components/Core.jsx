import React, { useState, useEffect, useRef } from 'react';

const Core = ({ onExit, onNavigate }) => {
  const [commsMode, setCommsMode] = useState('INDEX');
  const [lessonData, setLessonData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [indexData, setIndexData] = useState([]);
  const [openChapter, setOpenChapter] = useState(null);
  const currentAudioRef = useRef(null);
  const currentPlaybackIdRef = useRef(0);

  const [topicInput, setTopicInput] = useState('');
  const [contextInput, setContextInput] = useState('');

  useEffect(() => {
    const fetchIndex = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8080/api/index');
        const data = await res.json();
        setIndexData(data);
      } catch (err) {
        console.error("Failed to fetch index:", err);
      }
    };
    fetchIndex();
  }, []);

  const fetchLesson = async (requestStr, contextStr = "None") => {
    setIsLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:8080/api/lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_request: requestStr, context: contextStr })
      });
      const data = await res.json();
      setLessonData(data);
    } catch (err) {
      console.error(err);
    }
    setIsLoading(false);
  };

  const playAudio = async (asset) => {
    const playId = ++currentPlaybackIdRef.current;
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
    }

    const fallbackToTTS = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8080/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: asset.tts || asset.dutch || asset.subtext })
        });
        const blob = await res.blob();
        if (currentPlaybackIdRef.current !== playId) return;
        const url = window.URL.createObjectURL(blob);
        const audio = new window.Audio(url);
        currentAudioRef.current = audio;
        audio.play();
      } catch (e) {
        console.error("TTS Playback failed", e);
      }
    };

    if (!asset.audio || asset.audio === 'n/a') {
      return fallbackToTTS();
    }

    try {
      const localAudio = new window.Audio(`/audio/${asset.audio}`);
      currentAudioRef.current = localAudio;
      let hasFallenBack = false;
      const safeFallback = () => {
        if (!hasFallenBack && currentPlaybackIdRef.current === playId) {
          hasFallenBack = true;
          fallbackToTTS();
        }
      };
      localAudio.onerror = () => {
        console.warn(`Local audio not found: /audio/${asset.audio}, falling back to TTS...`);
        safeFallback();
      };
      localAudio.play().catch(e => {
        console.warn("Local play failed, fallback to TTS:", e);
        safeFallback();
      });
    } catch (e) {
      if (currentPlaybackIdRef.current === playId) fallbackToTTS();
    }
  };

  const handleStaticClick = (lessonId) => {
    fetchLesson(lessonId);
  };

  const handleDynamicSubmit = (e) => {
    e.preventDefault();
    if (!topicInput.trim()) return;
    fetchLesson(topicInput, contextInput || "No specific context provided.");
  };

  return (
    <>
      <style>{`
        @keyframes pureFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .lesson-fade-in {
          animation: pureFadeIn 1.2s ease-in-out forwards;
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        @keyframes pulse-opacity {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.6; }
        }
        @keyframes morph-line {
          0%, 100% { stroke-width: 0.5px; filter: drop-shadow(0 0 2px rgba(255,255,255,0.2)); }
          50% { stroke-width: 1.5px; filter: drop-shadow(0 0 8px rgba(255,255,255,0.6)); }
        }
        @keyframes drift {
          0% { transform: rotate(0deg) scale(1); }
          33% { transform: rotate(1deg) scale(1.02) translateX(2px); }
          66% { transform: rotate(-1deg) scale(0.98) translateX(-2px); }
          100% { transform: rotate(0deg) scale(1); }
        }
        .ghost-wrapper {
          animation: float 8s ease-in-out infinite, drift 12s ease-in-out infinite;
          transform-origin: center;
        }
        .ghost-path {
          fill: none;
          stroke: #ffffff;
          stroke-linecap: round;
          stroke-linejoin: round;
          transform-origin: center;
          transition: all 0.5s ease;
        }
        .layer-1 { animation: pulse-opacity 4s ease-in-out infinite 0s, morph-line 6s ease-in-out infinite 1s; }
        .layer-2 { animation: pulse-opacity 5s ease-in-out infinite 1s, morph-line 5s ease-in-out infinite 0s; }
        .layer-3 { animation: pulse-opacity 6s ease-in-out infinite 2s, morph-line 7s ease-in-out infinite 2s; }
        .layer-4 { animation: pulse-opacity 4.5s ease-in-out infinite 0.5s, morph-line 4s ease-in-out infinite 1.5s; }
        .layer-5 { animation: pulse-opacity 5.5s ease-in-out infinite 1.5s, morph-line 6s ease-in-out infinite 0.5s; }
      `}</style>
      <div className="w-full h-screen bg-[#050505] text-white font-body flex flex-col overflow-hidden selection:bg-white/20 selection:text-white noise">

      {/* ── Global Nav (matching NexusView / App landing) ── */}
      <nav className="relative top-0 left-0 w-full h-[100px] z-[100] px-8 md:px-12 flex items-center justify-between pointer-events-none mix-blend-difference flex-shrink-0">
        <div className="font-display font-bold text-2xl tracking-tighter text-white pointer-events-auto">
          APPARITIONS: CORE
        </div>

        <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-[40px] text-xs font-bold tracking-[0.2em] pointer-events-auto">
          <button onClick={onExit} className="text-[#555] hover:text-white transition-colors duration-300 tracking-[0.2em] focus:outline-none">HOME</button>
          <button onClick={() => onNavigate && onNavigate('menu')} className="text-[#555] hover:text-white transition-colors duration-300 tracking-[0.2em] focus:outline-none">GAMES</button>
          <button onClick={() => onNavigate && onNavigate('core')} className="text-white font-bold transition-colors duration-300 tracking-[0.2em] focus:outline-none drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]">CORE</button>
          <button onClick={() => onNavigate && onNavigate('nexus')} className="text-[#555] hover:text-white transition-colors duration-300 tracking-[0.2em] focus:outline-none">NEXUS</button>
          <button onClick={() => onNavigate && onNavigate('help')} className="text-[#555] hover:text-white transition-colors duration-300 tracking-[0.2em] focus:outline-none">HELP</button>
        </div>

        <div className="pointer-events-auto">
          <button onClick={() => onNavigate && onNavigate('contact')} className="px-6 py-2 border border-white/20 rounded-full text-xs font-bold uppercase tracking-wider text-white hover:bg-white hover:text-black transition-colors duration-500">
            Contact
          </button>
        </div>
      </nav>

      {/* ── Content Area ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT PANEL — Index / Open Channel */}
        <div className="absolute top-32 left-8 w-[320px] bg-black/50 border border-white/20 backdrop-blur-md shadow-2xl z-40 flex flex-col font-mono transition-all duration-300">

          {/* Toggle Header */}
          <div className="flex border-b border-white/10">
            <button
              onClick={() => setCommsMode('INDEX')}
              className={`flex-1 py-5 text-[10px] font-bold tracking-[0.2em] uppercase transition-all duration-500 ${commsMode === 'INDEX' ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'text-white/40 hover:text-white/70'}`}
            >
              Index
            </button>
            <button
              onClick={() => setCommsMode('OPEN_CHANNEL')}
              className={`flex-1 py-5 text-[10px] font-bold tracking-[0.2em] uppercase transition-all duration-500 border-l border-white/10 ${commsMode === 'OPEN_CHANNEL' ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'text-white/40 hover:text-white/70'}`}
            >
              Open Channel
            </button>
          </div>

          {/* Panel Content */}
          <div className="max-h-[calc(100vh-16rem)] overflow-y-auto px-6 py-6 scrollbar-hide w-full flex-1">
            {commsMode === 'INDEX' ? (
              <div className="flex flex-col gap-2">
                <div className="text-[#555] text-[9px] mb-6 uppercase tracking-[0.3em] font-bold">Available Archives</div>
                {indexData.length === 0 && (
                  <div className="text-[#333] text-[10px] tracking-[0.2em] uppercase animate-pulse">Loading index...</div>
                )}
                {Object.entries(indexData.reduce((acc, curr) => {
                  const chapter = curr.title || 'UNKNOWN ARCHIVE';
                  if (!acc[chapter]) acc[chapter] = [];
                  acc[chapter].push(curr);
                  return acc;
                }, {})).map(([chapterTitle, lessons]) => {
                  const isOpen = openChapter === chapterTitle;
                  return (
                    <div key={chapterTitle} className="mb-1">
                      <button
                        onClick={() => setOpenChapter(isOpen ? null : chapterTitle)}
                        className={`w-full text-left py-4 px-5 border transition-all duration-300 text-[10px] font-bold tracking-[0.15em] uppercase flex justify-between items-center group ${isOpen ? 'border-white/20 bg-white/5 text-white' : 'border-[#111] hover:border-[#333] text-[#666] hover:text-white'}`}
                      >
                        <span className="truncate pr-2 font-display tracking-tight text-xs normal-case">{chapterTitle}</span>
                        <span className={`text-[#444] transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`}>›</span>
                      </button>

                      {isOpen && (
                        <div className="flex flex-col border-x border-b border-[#111]">
                          {lessons.map(lesson => (
                            <button
                              key={lesson.id}
                              onClick={() => handleStaticClick(lesson.id)}
                              className="w-full text-left py-3 px-6 hover:bg-white/5 transition-all duration-300 text-[10px] tracking-[0.1em] text-[#555] hover:text-white border-b border-[#0a0a0a] last:border-b-0 group flex items-start gap-3"
                            >
                              <span className="text-[#333] group-hover:text-white mt-[1px] transition-colors">›</span>
                              <span className="leading-relaxed font-body">{lesson.subtitle || lesson.id}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col">
                <div className="text-[#555] text-[9px] mb-3 uppercase tracking-[0.3em] font-bold border-b border-[#111] pb-2">Dynamic Generator</div>

                <div className="space-y-3 text-[#888]">
                  <p className="text-[11px] leading-relaxed font-light">
                    Open a channel to the Apparition Engine and conjure custom lessons on demand. Provide a topic and optional real-world context.
                  </p>

                  <form onSubmit={handleDynamicSubmit} className="space-y-2">
                    <div className="space-y-1">
                      <label className="text-[8px] tracking-[0.2em] uppercase text-[#555] font-bold">Target Topic</label>
                      <input
                        type="text"
                        required
                        value={topicInput}
                        onChange={(e) => setTopicInput(e.target.value)}
                        placeholder="e.g. Buying a train ticket"
                        className="w-full bg-transparent border border-[#222] text-white py-1.5 px-2 text-[11px] font-body focus:outline-none focus:border-white/40 transition-colors placeholder:text-[#333]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[8px] tracking-[0.2em] uppercase text-[#555] font-bold">Environmental Context</label>
                      <textarea
                        value={contextInput}
                        onChange={(e) => setContextInput(e.target.value)}
                        placeholder="e.g. Busy central station during rush hour."
                        rows="2"
                        className="w-full bg-transparent border border-[#222] text-white py-1.5 px-2 text-[11px] font-body focus:outline-none focus:border-white/40 transition-colors placeholder:text-[#333] resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2 bg-white text-black font-display font-bold tracking-[0.15em] uppercase text-[9px] hover:bg-gray-200 transition-colors mt-1"
                    >
                      Conjure
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* MAIN STAGE — Lesson Display */}
        <div className="flex-1 bg-[#050505] relative flex flex-col overflow-y-auto pl-[352px]">

          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <span className="animate-pulse tracking-[0.4em] text-[#333] text-sm font-display uppercase">Decrypting...</span>
            </div>
          ) : !lessonData ? (
            <div className="flex-1 flex items-center justify-center px-8">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 450" className="w-[300px] md:w-[400px] pointer-events-none opacity-50" style={{ overflow: 'visible' }}>
                <defs>
                  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="6" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>
                <g className="ghost-wrapper">
                  <g filter="url(#glow)">
                    <path className="ghost-path layer-1" d="M 150 180 C 130 140 150 110 160 110 C 160 50 180 50 180 110 C 190 100 210 100 220 110 C 220 50 240 50 240 110 C 250 110 270 140 250 180 C 270 240 290 280 250 320 C 210 360 260 390 220 390 C 180 390 160 340 130 310 C 100 280 110 220 150 180 Z" />
                    <path className="ghost-path layer-2" d="M 155 185 C 138 145 155 115 163 115 C 163 58 178 58 178 112 C 190 105 210 105 222 112 C 222 58 237 58 237 115 C 245 115 262 145 245 185 C 260 235 275 275 240 315 C 205 355 245 385 210 385 C 175 385 165 345 140 315 C 115 285 120 230 155 185 Z" />
                    <path className="ghost-path layer-3" d="M 145 175 C 122 135 145 105 157 105 C 157 42 182 42 182 108 C 190 95 210 95 218 108 C 218 42 243 42 243 105 C 255 105 278 135 255 175 C 280 245 305 285 260 325 C 215 365 275 395 230 395 C 185 395 155 335 120 305 C 85 275 100 210 145 175 Z" />
                    <path className="ghost-path layer-4" d="M 160 190 C 145 150 160 120 168 120 C 168 65 176 65 176 115 C 190 110 210 110 224 115 C 224 65 232 65 232 120 C 240 120 255 150 240 190 C 250 230 260 270 230 300 C 200 330 230 370 200 370 C 170 370 170 330 150 300 C 130 270 130 220 160 190 Z" />
                    <path className="ghost-path layer-5" d="M 152 182 C 135 142 152 112 161 112 C 161 54 180 54 180 110 C 190 102 210 102 220 110 C 220 54 239 54 239 112 C 248 112 265 142 248 182 C 265 238 285 278 245 318 C 205 358 255 388 215 388 C 175 388 160 340 135 310 C 110 280 115 225 152 182 Z" />
                  </g>
                  <g className="face" filter="url(#glow)">
                    <ellipse cx="178" cy="142" rx="4" ry="6" fill="#ffffff" fillOpacity="0.9" />
                    <ellipse cx="178" cy="142" rx="2" ry="3" fill="#ffffff" />
                    <ellipse cx="222" cy="142" rx="4" ry="6" fill="#ffffff" fillOpacity="0.9" />
                    <ellipse cx="222" cy="142" rx="2" ry="3" fill="#ffffff" />
                    <g stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" opacity="0.9">
                      <path d="M 195 153 L 205 163" />
                      <path d="M 205 153 L 195 163" />
                    </g>
                  </g>
                </g>
              </svg>
            </div>
          ) : lessonData.error ? (
            <div className="flex-1 flex flex-col items-center justify-center">
              <span className="tracking-[0.3em] text-red-900 border border-red-900/30 bg-red-900/10 px-6 py-3 text-sm uppercase font-display">ERROR: {lessonData.error}</span>
            </div>
          ) : (
            <div className="lesson-fade-in max-w-[1100px] mx-auto w-full flex flex-col pt-[28px] pb-24 px-8 md:px-12">

              {/* Header Section */}
              <div className="mb-12">
                <h1 className="font-display font-bold text-[clamp(2.5rem,5vw,5rem)] text-white tracking-tighter mb-4 leading-[1.1]">
                  {lessonData.metadata?.title || 'UNKNOWN ARCHIVE'}
                </h1>
                <div className="text-[#555] text-[10px] tracking-[0.25em] font-bold uppercase mb-10 border-l-2 border-[#333] pl-4">
                  {lessonData.metadata?.subtitle || 'NO CONTEXT PROVIDED'}
                </div>
                <p className="text-[#888] text-[clamp(1.2rem,2vw,1.6rem)] font-light leading-relaxed max-w-4xl whitespace-pre-wrap">
                  {lessonData.content}
                </p>
              </div>

              {/* Assets Vertical List */}
              {/* Assets Rendered by Template */}
              <div className="w-full">
                {(() => {
                  const template = lessonData.metadata?.template || "Audio_List";
                  const assets = lessonData.assets || [];

                  const PlayButton = ({ asset }) => (
                    <button
                      onClick={() => playAudio(asset)}
                      className="text-[#333] hover:text-white transition-all duration-500 flex-shrink-0 focus:outline-none"
                      title="PLAY AUDIO"
                    >
                      <div className="w-8 h-8 border border-[#222] hover:border-white/50 bg-[#0a0a0a] rounded flex items-center justify-center transition-colors shadow-[0_0_15px_rgba(0,0,0,0.5)] cursor-pointer">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="ml-0.5">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </button>
                  );

                  switch(template) {
                    case "Grid_Interactive":
                      return (
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-8">
                          {assets.map((asset, idx) => (
                            <div key={idx} style={{ containerType: 'inline-size' }} className="relative flex flex-col items-center justify-center w-full p-4 bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl hover:bg-[#111] hover:border-[#333] transition-all duration-300 min-h-[130px] group overflow-hidden">
                              <div className="absolute top-2 right-2 opacity-50 group-hover:opacity-100 transition-opacity z-10">
                                 <PlayButton asset={asset} />
                              </div>
                              <span 
                                className="font-display font-bold text-white text-center break-words hyphens-auto mt-2 leading-[1.1] tracking-tighter w-full"
                                style={{ fontSize: `clamp(1rem, ${Math.min(18, 160 / Math.max(1, asset.dutch.length))}cqi, 2.8rem)` }}
                              >
                                {asset.dutch}
                              </span>
                              <span className="text-[9px] text-[#555] uppercase tracking-[0.2em] font-bold mt-4 text-center">
                                {asset.english} <span className="text-[#333] px-1">•</span> {asset.pronunciation}
                              </span>
                            </div>
                          ))}
                        </div>
                      );

                    case "Sequence_List":
                      return (
                        <div className="relative border-l border-[#222] ml-4 mt-8">
                          {assets.map((asset, idx) => (
                            <div key={idx} className="relative flex items-center gap-5 py-5 group border-b border-[#0a0a0a] last:border-b-0 pl-8">
                              {/* Node Dot */}
                              <div className="absolute -left-[5px] w-[9px] h-[9px] bg-[#333] group-hover:bg-white group-hover:shadow-[0_0_10px_rgba(255,255,255,0.8)] rounded-full transition-all duration-500" />
                              
                              <PlayButton asset={asset} />
                              
                              <div className="flex flex-col gap-1 min-w-0 flex-1">
                                <span className="text-white font-bold text-xl md:text-2xl font-display break-words hyphens-auto tracking-tight">{asset.dutch}</span>
                                <div className="flex gap-3 text-[10px] md:text-xs text-[#777] font-medium tracking-widest mt-1 uppercase">
                                  <span>{asset.english}</span>
                                  <span className="text-[#333]">/</span>
                                  <span className="text-[#555]">{asset.pronunciation}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      );

                    case "Dialogue_Scenario":
                      return (
                        <div className="flex flex-col gap-6 mt-8">
                          {assets.map((asset, idx) => {
                            const isYou = asset.speaker === "you";
                            return (
                              <div key={idx} className={`flex flex-col ${isYou ? 'items-end' : 'items-start'} max-w-[85%] ${isYou ? 'self-end' : 'self-start'}`}>
                                <div className="text-[9px] text-[#555] font-bold tracking-[0.25em] uppercase mb-2 px-2">
                                  {isYou ? 'YOU' : (asset.speaker || 'THEM')}
                                </div>
                                <div className={`p-4 flex items-center gap-4 ${isYou ? 'bg-[#151515] border border-[#222] text-right rounded-t-xl rounded-bl-xl rounded-br-sm' : 'bg-transparent border border-[#1a1a1a] rounded-t-xl rounded-br-xl rounded-bl-sm'} transition-colors hover:border-[#333]`}>
                                  {!isYou && <PlayButton asset={asset} />}
                                  <div className="flex flex-col gap-1 min-w-0 flex-1 px-1">
                                    <span className="text-white font-medium text-lg leading-relaxed">{asset.dutch}</span>
                                    <span className="text-[#666] text-[10px] uppercase tracking-[0.1em] mt-1">{asset.english}</span>
                                  </div>
                                  {isYou && <PlayButton asset={asset} />}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );

                    case "Grouped_List":
                      const grouped = assets.reduce((acc, curr) => {
                        const g = curr.group || "General";
                        if (!acc[g]) acc[g] = [];
                        acc[g].push(curr);
                        return acc;
                      }, {});

                      return (
                        <div className="flex flex-col gap-12 mt-8">
                          {Object.entries(grouped).map(([groupName, groupAssets]) => (
                            <div key={groupName} className="flex flex-col">
                              <h3 className="sticky top-0 bg-[#050505]/95 backdrop-blur-md z-10 py-4 text-[#888] text-[10px] uppercase font-bold tracking-[0.3em] border-b border-[#111] mb-2">
                                {groupName}
                              </h3>
                              <div className="flex flex-col">
                                {groupAssets.map((asset, idx) => (
                                  <div key={idx} className="group flex items-center gap-5 py-5 border-b border-[#0a0a0a] last:border-b-0 hover:bg-white/[0.02] transition-colors rounded-lg px-2">
                                    <PlayButton asset={asset} />
                                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                                      <span className="text-white font-bold text-xl md:text-2xl font-display break-words hyphens-auto tracking-tight">{asset.dutch}</span>
                                      <div className="flex flex-wrap gap-4 text-[10px] text-[#777] font-medium tracking-[0.15em] mt-1 uppercase">
                                        <span>{asset.english}</span>
                                        <span className="text-[#333]">/</span>
                                        <span className="text-[#555]">{asset.pronunciation}</span>
                                      </div>
                                    </div>
                                    {asset.type && (
                                      <div className="hidden md:block ml-auto text-[#333] text-[9px] uppercase tracking-[0.3em] font-bold">
                                        {asset.type}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      );

                    case "Audio_List":
                    default:
                      return (
                        <div className="flex flex-col mt-6 border-t border-[#111]">
                          {assets.map((asset, idx) => (
                            <div key={idx} className="group flex flex-col md:flex-row items-start md:items-center p-5 border-b border-[#111] hover:bg-[#0a0a0a] transition-all duration-500 gap-5 rounded-lg">
                              <PlayButton asset={asset} />
                              <div className="flex flex-col gap-1 min-w-0 w-full flex-1">
                                <span className="text-white font-display text-xl md:text-2xl font-bold tracking-tight break-words hyphens-auto">
                                  {asset.dutch}
                                </span>
                                <div className="flex flex-wrap items-center gap-3 text-[#777] text-[10px] font-body font-bold tracking-[0.15em] uppercase">
                                  <span>{asset.english}</span>
                                  <span className="text-[#333]">•</span>
                                  <span className="text-[#555]">[ {asset.pronunciation} ]</span>
                                </div>
                              </div>
                              {asset.type && (
                                <div className="hidden md:block ml-auto text-[#444] text-[9px] uppercase tracking-[0.3em] font-bold">
                                  {asset.type}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                  }
                })()}
              </div>

              <div className="h-32" />
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
};

export default Core;
