import React, { useState, useEffect, useRef } from 'react';
import comprehensionData from '../comprehension_stories.json';

type Story = typeof comprehensionData.comprehension_stories[0];

const SFX_CLACK_FREQ_START = 800;
const SFX_CLACK_FREQ_END = 100;
const SFX_CLACK_DURATION = 0.05;

const SFX_ERROR_FREQ_START = 200;
const SFX_ERROR_FREQ_END = 50;
const SFX_ERROR_DURATION = 0.2;

const WIN_TRANSITION_DELAY_MS = 1000;
const ERROR_FEEDBACK_DURATION_MS = 500;

export const ComprehensionGame = ({ onExit, onWin }: { onExit: () => void, onWin?: () => void }) => {
    // Currently selected story index
    const [storyIndex, setStoryIndex] = useState(0);
    const story: Story = comprehensionData.comprehension_stories[storyIndex];

    /* Map of DropZone IDs (for example: "s0_w4") to the dropped word */
    const [droppedWords, setDroppedWords] = useState<Record<string, string>>({});

    /* The available words in the pool, randomly shuffled */
    const [decryptionPool, setDecryptionPool] = useState<string[]>([]);

    /* State tracking the completion of the decryption task */
    const [isGameWon, setIsGameWon] = useState(false);

    /* Mobile tap-to-select word state */
    const [selectedWord, setSelectedWord] = useState<string | null>(null);

    // Audio / Sync state
    const [isPlaying, setIsPlaying] = useState(false);
    const [useNeuralVoice, setUseNeuralVoice] = useState(false);
    const [activeSentenceIdx, setActiveSentenceIdx] = useState<number | null>(null);
    const neuralAudioRef = useRef<HTMLAudioElement | null>(null);

    // Error feedback
    const [errorDropId, setErrorDropId] = useState<string | null>(null);

    // Audio SFX
    const playSFX = (type: 'clack' | 'rumble' | 'error') => {
        try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();

            if (type === 'clack') {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'square';
                osc.frequency.setValueAtTime(SFX_CLACK_FREQ_START, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(SFX_CLACK_FREQ_END, ctx.currentTime + SFX_CLACK_DURATION);
                gain.gain.setValueAtTime(0.5, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + SFX_CLACK_DURATION);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + SFX_CLACK_DURATION);
            } else if (type === 'error') {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(SFX_ERROR_FREQ_START, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(SFX_ERROR_FREQ_END, ctx.currentTime + SFX_ERROR_DURATION);
                gain.gain.setValueAtTime(0.3, ctx.currentTime);
                gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + SFX_ERROR_DURATION);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + SFX_ERROR_DURATION);
            }
        } catch (e) { }
    };

    useEffect(() => {
        return () => {
            if ('speechSynthesis' in window) window.speechSynthesis.cancel();
            if (neuralAudioRef.current) {
                neuralAudioRef.current.pause();
            }
        };
    }, []);

    const stopPlayback = () => {
        setIsPlaying(false);
        setActiveSentenceIdx(null);
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
        if (neuralAudioRef.current) {
            neuralAudioRef.current.pause();
            neuralAudioRef.current.currentTime = 0;
            neuralAudioRef.current = null;
        }
    };

    const handlePlayStory = async () => {
        if (isPlaying) {
            stopPlayback();
            return;
        }

        stopPlayback();
        setIsPlaying(true);

        if (useNeuralVoice) {
            try {
                // @ts-ignore
                const fullText = story.full_nl_text || story.sentences.map(s => s.nl).join(' ');

                const response = await fetch('/api/tts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: fullText })
                });

                if (!response.ok) {
                    console.error("TTS fetch failed", await response.text());
                    setIsPlaying(false);
                    return;
                }

                const blob = await response.blob();
                const audioUrl = URL.createObjectURL(blob);
                const audio = new Audio(audioUrl);
                neuralAudioRef.current = audio;

                audio.onended = () => {
                    setIsPlaying(false);
                };

                audio.play().catch(e => {
                    console.error("Neural playback failed", e);
                    setIsPlaying(false);
                });
            } catch (err) {
                console.error("Neural TTS request error", err);
                setIsPlaying(false);
            }
        } else {
            // Local Web Speech synthesis
            if (!('speechSynthesis' in window)) {
                setIsPlaying(false);
                return;
            }

            const playSentence = (idx: number) => {
                if (idx >= story.sentences.length) {
                    stopPlayback();
                    return;
                }

                setActiveSentenceIdx(idx);
                const s = story.sentences[idx];
                const words = s.nl.split(' ');

                /* Split sentence into spoken text and pauses for redacted words */
                const segments: { type: 'speak' | 'pause'; text: string }[] = [];
                let currentSpoken: string[] = [];

                words.forEach(w => {
                    const clean = w.replace(/[.,!?]/g, '');
                    if (s.redacted_words.includes(clean)) {
                        if (currentSpoken.length > 0) {
                            segments.push({ type: 'speak', text: currentSpoken.join(' ') });
                            currentSpoken = [];
                        }
                        segments.push({ type: 'pause', text: clean });
                    } else {
                        currentSpoken.push(w);
                    }
                });

                if (currentSpoken.length > 0) {
                    segments.push({ type: 'speak', text: currentSpoken.join(' ') });
                }

                const playSegment = (segIdx: number) => {
                    if (segIdx >= segments.length) {
                        playSentence(idx + 1);
                        return;
                    }

                    const seg = segments[segIdx];

                    if (seg.type === 'pause') {
                        setTimeout(() => playSegment(segIdx + 1), 700);
                    } else {
                        const utterance = new SpeechSynthesisUtterance(seg.text);
                        utterance.lang = 'nl-NL';
                        utterance.rate = 0.85;
                        utterance.pitch = 0.8;
                        utterance.onend = () => playSegment(segIdx + 1);
                        window.speechSynthesis.speak(utterance);
                    }
                };

                playSegment(0);
            };

            playSentence(0);
        }
    };

    useEffect(() => {
        /* Initialise pool for the current story */
        const allRedacted: string[] = [];
        story.sentences.forEach(s => {
            if (s.redacted_words) {
                allRedacted.push(...s.redacted_words);
            }
        });

        /* Initialises the pool with randomly shuffled words */
        const shuffled = [...allRedacted].sort(() => Math.random() - 0.5);
        setDecryptionPool(shuffled);
        setDroppedWords({});
        setSelectedWord(null);
        setIsGameWon(false);
    }, [storyIndex]);

    useEffect(() => {
        /* Triggers the win state when all words from the pool are placed correctly */
        if (decryptionPool.length === 0 && Object.keys(droppedWords).length > 0) {
            setTimeout(() => {
                setIsGameWon(true);
                if (onWin) onWin();
            }, WIN_TRANSITION_DELAY_MS);
        }
    }, [decryptionPool, droppedWords, onWin]);

    // Unified placement logic for both Drag-and-Drop and Tap-to-Place
    const handlePlaceWord = (sentenceIdx: number, wordIdx: number, expectedWord: string, candidateWord?: string) => {
        const wordToTest = candidateWord || selectedWord;
        if (!wordToTest) return;

        const cleanExpected = expectedWord.replace(/[.,!?]/g, '');

        if (wordToTest === cleanExpected) {
            playSFX('clack');
            setDroppedWords(prev => ({
                ...prev,
                [`s${sentenceIdx}_w${wordIdx}`]: wordToTest
            }));

            setDecryptionPool(prev => {
                const newPool = [...prev];
                const index = newPool.indexOf(wordToTest);
                if (index > -1) newPool.splice(index, 1);
                return newPool;
            });
            setSelectedWord(null);
        } else {
            playSFX('error');
            const dropId = `s${sentenceIdx}_w${wordIdx}`;
            setErrorDropId(dropId);
            setTimeout(() => setErrorDropId(null), ERROR_FEEDBACK_DURATION_MS);
        }
    };

    const handleReturnWord = (dropId: string, placedWord: string) => {
        playSFX('clack');
        setDroppedWords(prev => {
            const updated = { ...prev };
            delete updated[dropId];
            return updated;
        });
        setDecryptionPool(prev => [...prev, placedWord]);
    };

    const handleDragStart = (e: React.DragEvent, word: string) => {
        e.dataTransfer.setData("text/plain", word);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent, sentenceIdx: number, wordIdx: number, expectedWord: string) => {
        e.preventDefault();
        const draggedWord = e.dataTransfer.getData("text/plain");
        handlePlaceWord(sentenceIdx, wordIdx, expectedWord, draggedWord);
    };

    if (isGameWon) {
        return (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-1000 px-6 py-10 text-center">
                <h2 className="text-white text-[clamp(1.1rem,6vw,2.25rem)] mb-4 tracking-[0.2em] sm:tracking-[0.3em] font-light leading-tight">DECRYPTION COMPLETE</h2>
                <div className="text-gray-400 text-sm sm:text-lg md:text-xl font-mono mb-8 sm:mb-12 tracking-wider text-center max-w-full break-words">
                    STORY: <span className="text-white font-bold">{story.title_en}</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-6 w-full max-w-xs sm:max-w-none sm:w-auto">
                    <button
                        onClick={() => {
                            if (storyIndex < comprehensionData.comprehension_stories.length - 1) {
                                setStoryIndex(prev => prev + 1);
                            } else {
                                setStoryIndex(0); // Loop back
                            }
                        }}
                        className="w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 bg-[#1a1a1a] border border-[#333] text-[#aaa] text-xs sm:text-sm font-mono tracking-widest uppercase hover:text-white hover:bg-[#222] hover:border-[#555] transition-all duration-300 shadow-[0_0_15px_rgba(0,0,0,0.8)] focus:outline-none"
                    >
                        NEXT_TRANSCRIPT
                    </button>
                    <button
                        onClick={onExit}
                        className="w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 bg-transparent border border-[#333] text-[#666] text-xs sm:text-sm font-mono tracking-widest uppercase hover:text-white hover:border-[#555] transition-all duration-300 focus:outline-none"
                    >
                        EXIT
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-5xl h-full flex flex-col items-center animate-in slide-in-from-bottom-8 duration-1000">
            <div className="w-full h-full flex flex-col bg-black border border-white/10 p-3 sm:p-8 shadow-2xl overflow-hidden relative group">
                {/* Title */}
                <div className="w-full flex justify-between items-baseline mb-4 sm:mb-6 border-b border-white/20 pb-3">
                    <h2 className="text-lg sm:text-2xl md:text-3xl font-mono tracking-[0.2em]">{story.title_nl}</h2>
                    <span className="text-[10px] sm:text-xs md:text-sm font-mono tracking-widest text-[#666] uppercase">{story.theme}</span>
                </div>

                {/* Workspace (Layout split) */}
                <div className="flex-1 w-full flex flex-col md:flex-row gap-4 md:gap-8 min-h-0 overflow-hidden">
                    {/* Left/Main: Transcript reader */}
                    <div className="flex-1 h-full overflow-y-auto pr-2 sm:pr-4 scrollbar-hide flex flex-col gap-4 sm:gap-6 font-mono text-sm sm:text-base md:text-xl leading-relaxed">
                        {story.sentences.map((sentence, sIdx) => {
                            const words = sentence.nl.split(" ");
                            const isSentenceActive = activeSentenceIdx === sIdx;

                            return (
                                <div key={sIdx} className={`w-full leading-[2.2] sm:leading-[2.5] transition-all duration-300 ${isSentenceActive ? 'opacity-100 font-medium' : 'opacity-80'}`}>
                                    <div className="flex flex-wrap gap-x-1.5 sm:gap-x-2 gap-y-1 items-center">
                                        {words.map((word, wIdx) => {
                                            const cleanWord = word.replace(/[.,!?]/g, '');
                                            const isRedacted = sentence.redacted_words.includes(cleanWord);
                                            const dropId = `s${sIdx}_w${wIdx}`;
                                            const droppedWord = droppedWords[dropId];
                                            const isError = errorDropId === dropId;

                                            if (isRedacted) {
                                                if (droppedWord) {
                                                    // Successfully filled - tap to return to pool
                                                    return (
                                                        <span 
                                                            key={wIdx} 
                                                            onClick={() => handleReturnWord(dropId, droppedWord)}
                                                            className="text-white font-bold tracking-wider inline-flex items-center shadow-[0_0_15px_rgba(255,255,255,0.2)] animate-in fade-in zoom-in-50 duration-300 cursor-pointer hover:text-red-400 transition-colors"
                                                            title="Tap to return word to pool"
                                                        >
                                                            {word}
                                                        </span>
                                                    );
                                                }
                                                // Empty Drop Zone (drag or tap-to-place)
                                                return (
                                                    <span
                                                        key={wIdx}
                                                        onDragOver={handleDragOver}
                                                        onDrop={(e) => handleDrop(e, sIdx, wIdx, word)}
                                                        onClick={() => handlePlaceWord(sIdx, wIdx, word)}
                                                        className={`inline-block border px-2 sm:px-4 py-0.5 select-none min-w-[65px] sm:min-w-[80px] text-center cursor-pointer transition-all ${
                                                            isError 
                                                                ? 'bg-red-900 border-red-500 text-transparent animate-digital-aberration' 
                                                                : selectedWord 
                                                                ? 'bg-[#1a1a1a] border-white/60 text-white/60 animate-pulse hover:bg-white/20' 
                                                                : 'bg-[#111] border-[#333] text-transparent hover:bg-[#222] hover:border-white/50'
                                                        }`}
                                                        title={selectedWord ? `Tap to insert "${selectedWord}"` : 'Select a word from pool to insert here'}
                                                    >
                                                        {selectedWord ? `[ ? ]` : cleanWord}
                                                    </span>
                                                );
                                            }

                                            // Standard word
                                            return <span key={wIdx} className={`${isSentenceActive ? 'text-white' : 'text-[#888]'} transition-colors duration-300 cursor-help hover:text-white`} title={sentence.en}>{word}</span>;
                                        })}
                                    </div>
                                    <span className="block mt-1 text-[10px] sm:text-xs text-[#444] tracking-wide sm:tracking-widest uppercase w-full leading-snug break-words hover:text-white transition-colors duration-300 cursor-help" title={sentence.en}>
                                        [ {sentence.en} ]
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Right: Decryption Pool / Work area */}
                    <div className="w-full md:w-1/3 max-h-[35vh] md:max-h-full flex flex-col gap-3 sm:gap-4 border-t md:border-t-0 md:border-l border-white/10 pt-3 md:pt-0 md:pl-8 overflow-y-auto">
                        <div className="flex flex-col gap-2 w-full">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] sm:text-xs tracking-[0.3em] text-[#888] uppercase font-mono">Decryption Pool</span>
                                {selectedWord && (
                                    <span className="text-[10px] text-yellow-400 font-mono tracking-wider animate-pulse">
                                        TAP TARGET BLANK ➔
                                    </span>
                                )}
                            </div>
                            {/* Media Player */}
                            <div className="flex items-center gap-3 w-full">
                                <button
                                    onClick={() => {
                                        stopPlayback();
                                        setUseNeuralVoice(!useNeuralVoice);
                                    }}
                                    className="text-[10px] sm:text-xs font-mono tracking-[0.2em] border border-[#333] px-2.5 py-1 flex items-center justify-between transition-all hover:bg-[#1a1a1a] group uppercase w-32 sm:w-36"
                                >
                                    <span className="text-gray-600 group-hover:text-white flex-shrink-0">VOICE:</span>
                                    <span className="text-white text-right">{useNeuralVoice ? "NEURAL" : "SYNTH"}</span>
                                </button>

                                <button onClick={handlePlayStory} className="hover:text-white transition-colors flex items-center justify-center text-[#aaa] w-7 h-7 sm:w-8 sm:h-8 border border-[#333]">
                                    {isPlaying ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                                            <rect x="4" y="3" width="3" height="10" />
                                            <rect x="9" y="3" width="3" height="10" />
                                        </svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                                            <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Word Pool */}
                        <div className="w-full flex flex-wrap gap-2 sm:gap-3">
                            {decryptionPool.map((word, idx) => {
                                const isSelected = selectedWord === word;
                                return (
                                    <div
                                        key={`${word}-${idx}`}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, word)}
                                        onClick={() => setSelectedWord(isSelected ? null : word)}
                                        className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm tracking-widest cursor-pointer select-none transition-all shadow-[2px_2px_8px_rgba(0,0,0,0.6)] active:scale-95 border ${
                                            isSelected
                                                ? 'bg-white text-black border-white ring-2 ring-white font-bold scale-105'
                                                : 'bg-[#1a1a1a] border-[#444] text-[#ddd] hover:bg-white hover:text-black hover:border-white'
                                        }`}
                                    >
                                        {word}
                                    </div>
                                );
                            })}
                            {decryptionPool.length === 0 && (
                                <div className="w-full text-center text-emerald-400 text-xs font-mono tracking-widest uppercase mt-2">
                                    ✓ Decryption Complete
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
