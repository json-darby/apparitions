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

                const response = await fetch('http://localhost:8000/api/tts', {
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
                const url = URL.createObjectURL(blob);
                const audio = new Audio(url);
                neuralAudioRef.current = audio;

                audio.onended = () => setIsPlaying(false);
                audio.onerror = () => setIsPlaying(false);

                audio.play();

            } catch (err) {
                console.error("Failed to fetch Neural TTS", err);
                setIsPlaying(false);
            }
        } else {
            if (!('speechSynthesis' in window)) {
                setIsPlaying(false);
                return;
            }

            const REDACTED_PAUSE_MS = 600;

            const playSentence = (idx: number) => {
                if (idx >= story.sentences.length) {
                    setIsPlaying(false);
                    setActiveSentenceIdx(null);
                    return;
                }

                setActiveSentenceIdx(idx);

                const sentence = story.sentences[idx];
                const words = sentence.nl.split(' ');

                /* Build segments: group consecutive spoken words together,
                   and mark gaps where unplaced redacted words sit. */
                type Segment = { type: 'speak'; text: string } | { type: 'pause' };
                const segments: Segment[] = [];
                let currentSpoken: string[] = [];

                words.forEach((word, wIdx) => {
                    const cleanWord = word.replace(/[.,!?]/g, '');
                    const isRedacted = sentence.redacted_words.includes(cleanWord);
                    const dropId = `s${idx}_w${wIdx}`;
                    const isPlaced = !!droppedWords[dropId];

                    if (isRedacted && !isPlaced) {
                        /* Unplaced redacted word — flush any accumulated spoken words, then insert a pause */
                        if (currentSpoken.length > 0) {
                            segments.push({ type: 'speak', text: currentSpoken.join(' ') });
                            currentSpoken = [];
                        }
                        segments.push({ type: 'pause' });
                    } else {
                        /* Normal word or correctly placed redacted word — accumulate */
                        currentSpoken.push(word);
                    }
                });

                /* Flush any remaining spoken words */
                if (currentSpoken.length > 0) {
                    segments.push({ type: 'speak', text: currentSpoken.join(' ') });
                }

                /* Play segments sequentially: speak text, pause for gaps */
                const playSegment = (segIdx: number) => {
                    if (segIdx >= segments.length) {
                        playSentence(idx + 1);
                        return;
                    }

                    const seg = segments[segIdx];

                    if (seg.type === 'pause') {
                        setTimeout(() => playSegment(segIdx + 1), REDACTED_PAUSE_MS);
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

    const handleDragStart = (e: React.DragEvent, word: string) => {
        e.dataTransfer.setData("text/plain", word);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault(); // Necessary to allow dropping
    };

    const handleDrop = (e: React.DragEvent, sentenceIdx: number, wordIdx: number, expectedWord: string) => {
        e.preventDefault();
        const draggedWord = e.dataTransfer.getData("text/plain");

        /* Cleans the expected word of punctuation for matching */
        const cleanExpected = expectedWord.replace(/[.,!?]/g, '');

        if (draggedWord === cleanExpected) {
            playSFX('clack');
            // Success
            setDroppedWords(prev => ({
                ...prev,
                [`s${sentenceIdx}_w${wordIdx}`]: draggedWord
            }));

            /* Removes the first matching instance of the placed word from the pool */
            setDecryptionPool(prev => {
                const newPool = [...prev];
                const index = newPool.indexOf(draggedWord);
                if (index > -1) newPool.splice(index, 1);
                return newPool;
            });
        } else {
            /* Handles incorrect placements by playing an error sound and pulsing the drop zone */
            playSFX('error');
            const dropId = `s${sentenceIdx}_w${wordIdx}`;
            setErrorDropId(dropId);
            setTimeout(() => setErrorDropId(null), ERROR_FEEDBACK_DURATION_MS);
        }
    };

    if (isGameWon) {
        return (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-1000">
                <h2 className="text-white text-4xl mb-4 tracking-[0.3em] font-light">DECRYPTION COMPLETE</h2>
                <div className="text-gray-400 text-xl font-mono mb-12 tracking-widest text-center">
                    STORY: <span className="text-white font-bold">{story.title_en}</span>
                </div>
                <div className="flex gap-6">
                    <button
                        onClick={() => {
                            if (storyIndex < comprehensionData.comprehension_stories.length - 1) {
                                setStoryIndex(prev => prev + 1);
                            } else {
                                setStoryIndex(0); // Loop back
                            }
                        }}
                        className="px-8 py-4 bg-[#1a1a1a] border border-[#333] text-[#aaa] font-mono tracking-widest uppercase hover:text-white hover:bg-[#222] hover:border-[#555] transition-all duration-300 shadow-[0_0_15px_rgba(0,0,0,0.8)] focus:outline-none"
                    >
                        NEXT_TRANSCRIPT
                    </button>
                    <button
                        onClick={onExit}
                        className="px-8 py-4 bg-transparent border border-[#333] text-[#666] font-mono tracking-widest uppercase hover:text-white hover:border-[#555] transition-all duration-300 focus:outline-none"
                    >
                        EXIT
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-5xl h-full flex flex-col items-center animate-in slide-in-from-bottom-8 duration-1000">
            <div className="w-full h-full flex flex-col bg-black border border-white/10 p-8 shadow-2xl overflow-hidden relative group">
                {/* Title */}
                <div className="w-full flex justify-between items-baseline mb-12 border-b border-white/20 pb-4">
                    <h2 className="text-3xl font-mono tracking-[0.2em]">{story.title_nl}</h2>
                    <span className="text-sm font-mono tracking-widest text-[#666] uppercase">{story.theme}</span>
                </div>

                {/* Workspace (Layout split) */}
                <div className="flex-1 w-full flex flex-col md:flex-row gap-8 min-h-0">
                    {/* Left: Transcript reader */}
                    <div className="w-full md:w-2/3 h-full overflow-y-auto pr-4 scrollbar-hide flex flex-col gap-6 font-mono text-lg md:text-xl leading-relaxed">
                        {story.sentences.map((sentence, sIdx) => {
                            const words = sentence.nl.split(" ");
                            const isSentenceActive = activeSentenceIdx === sIdx;

                            return (
                                <div key={sIdx} className={`w-full leading-[2.5] transition-all duration-300 ${isSentenceActive ? 'opacity-100 font-medium' : 'opacity-80'}`}>
                                    <div className="flex flex-wrap gap-x-2 gap-y-1">
                                        {words.map((word, wIdx) => {
                                            const cleanWord = word.replace(/[.,!?]/g, '');
                                            const isRedacted = sentence.redacted_words.includes(cleanWord);
                                            const dropId = `s${sIdx}_w${wIdx}`;
                                            const droppedWord = droppedWords[dropId];
                                            const isError = errorDropId === dropId;

                                            if (isRedacted) {
                                                if (droppedWord) {
                                                    // Successfully filled
                                                    return (
                                                        <span key={wIdx} className="text-white font-bold tracking-wider inline-flex items-center shadow-[0_0_15px_rgba(255,255,255,0.2)] animate-in fade-in zoom-in-50 duration-300">
                                                            {word}
                                                        </span>
                                                    );
                                                }
                                                // Empty Drop Zone
                                                return (
                                                    <span
                                                        key={wIdx}
                                                        onDragOver={handleDragOver}
                                                        onDrop={(e) => handleDrop(e, sIdx, wIdx, word)}
                                                        className={`inline-block ${isError ? 'bg-red-900 border-red-500 animate-digital-aberration' : 'bg-[#111] border-[#333] hover:bg-[#222] hover:border-white/50'} text-transparent border px-4 select-none min-w-[80px] transition-colors`}
                                                    >
                                                        {cleanWord}
                                                    </span>
                                                );
                                            }

                                            // Standard word
                                            return <span key={wIdx} className={`${isSentenceActive ? 'text-white' : 'text-[#888]'} transition-colors duration-300 cursor-help hover:text-white`} title={sentence.en}>{word}</span>;
                                        })}
                                    </div>
                                    <span className="block mt-2 text-xs text-[#444] tracking-widest uppercase truncate w-full hover:text-white transition-colors duration-300 cursor-help" title={sentence.en}>
                                        [ {sentence.en} ]
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Right: Decryption Pool / Work area */}
                    <div className="w-full md:w-1/3 h-full flex flex-col gap-4 border-t md:border-t-0 md:border-l border-white/10 pt-6 md:pt-0 md:pl-8">
                        <div className="mb-4 flex flex-col gap-4 w-full">
                            <span className="text-xs tracking-[0.3em] text-[#666] uppercase">Decryption Pool</span>
                            {/* Media Player */}
                            <div className="flex items-center gap-3 w-full">
                                <button
                                    onClick={() => {
                                        stopPlayback();
                                        setUseNeuralVoice(!useNeuralVoice);
                                    }}
                                    className="text-xs font-mono tracking-[0.2em] border border-[#333] px-3 py-1 flex items-center justify-between transition-all hover:bg-[#1a1a1a] group uppercase w-36"
                                >
                                    <span className="text-gray-600 group-hover:text-white flex-shrink-0">VOICE:</span>
                                    <span className="text-white text-right">{useNeuralVoice ? "NEURAL" : "SYNTH"}</span>
                                </button>

                                <button onClick={handlePlayStory} className="hover:text-white transition-colors flex items-center justify-center text-[#aaa] w-8 h-8">
                                    {isPlaying ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                            <rect x="5" y="4" width="2" height="8" />
                                            <rect x="9" y="4" width="2" height="8" />
                                        </svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                            <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Word Pool */}
                        <div className="w-full flex flex-wrap gap-3">
                            {decryptionPool.map((word, idx) => (
                                <div
                                    key={`${word}-${idx}`}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, word)}
                                    className="px-4 py-2 bg-[#1a1a1a] border border-[#444] text-[#ddd] text-sm tracking-widest cursor-move hover:bg-white hover:text-black hover:border-white transition-colors select-none shadow-[2px_2px_10px_rgba(0,0,0,0.5)] active:scale-95"
                                >
                                    {word}
                                </div>
                            ))}
                            {decryptionPool.length === 0 && (
                                <div className="w-full text-center text-[#444] text-xs font-mono tracking-widest uppercase mt-4">
                                    Decryption Complete
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
