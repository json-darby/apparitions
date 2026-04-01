import React, { useState, useEffect, useRef } from 'react';
import vocabulary from '../the_list.json';

type Card = {
    id: string; // unique string per instance
    matchId: string; // shared id between the EN/NL pair
    word: string;
    isDutch: boolean;
    isFlipped: boolean;
    isMatched: boolean;
};

const MATCH_PULSE_DURATION_MS = 600;
const MISMATCH_RESTORE_DURATION_MS = 1200;
const WIN_TRANSITION_DELAY_MS = 1000;
const RUMBLE_FREQ_START = 60;
const RUMBLE_FREQ_END = 30;
const RUMBLE_DURATION = 0.1;

/* Shuffles an array in place */
function shuffle(array: any[]) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
}

/* Checks if 1D indices i and j are adjacent in a 6x6 grid */
function areAdjacent(i: number, j: number) {
    const rowI = Math.floor(i / 6);
    const colI = i % 6;
    const rowJ = Math.floor(j / 6);
    const colJ = j % 6;
    // Adjacent if they share a row and columns differ by 1, or share a col and rows differ by 1
    return (rowI === rowJ && Math.abs(colI - colJ) === 1) || (colI === colJ && Math.abs(rowI - rowJ) === 1);
}

/* Checks the entire board for adjacent matches. Returns the first violating pair's indices, or null if clean. */
function findViolation(board: Card[]) {
    for (let i = 0; i < 24; i++) {
        // Check right (if not right edge)
        if (i % 6 !== 5) {
            if (board[i].matchId === board[i + 1].matchId) return [i, i + 1];
        }
        // Check down (if not bottom edge)
        if (Math.floor(i / 6) !== 3) {
            if (board[i].matchId === board[i + 6].matchId) return [i, i + 6];
        }
    }
    return null;
}

/* Generates a clean board of 24 cards */
function generateCleanBoard(): Card[] {
    // 1. Pick 12 random pairs
    const shuffledVocab = shuffle([...vocabulary]);
    const selectedPairs = shuffledVocab.slice(0, 12);

    // 2. Create the 24 cards
    const initialBoard: Card[] = [];
    selectedPairs.forEach((pair, index) => {
        const matchId = `pair_${index}`;
        initialBoard.push({
            id: `${matchId}_nl`,
            matchId,
            word: pair.nl,
            isDutch: true,
            isFlipped: false,
            isMatched: false,
        });
        initialBoard.push({
            id: `${matchId}_en`,
            matchId,
            word: pair.en,
            isDutch: false,
            isFlipped: false,
            isMatched: false,
        });
    });

    // 3. Shuffle
    let currentBoard = shuffle([...initialBoard]);

    // 4. Resolve adjacent violations
    let violation = findViolation(currentBoard);
    let attempts = 0;
    while (violation && attempts < 1000) {
        // Swap the second violating card with a random card on the board
        const [idxA, idxB] = violation;
        let randomIdx = Math.floor(Math.random() * 24);
        // don't swap with itself, its matching pair (idxA), or another card that would immediately cause a violation
        // (a simple random swap usually resolves it within a few iterations)
        [currentBoard[idxB], currentBoard[randomIdx]] = [currentBoard[randomIdx], currentBoard[idxB]];

        violation = findViolation(currentBoard);
        attempts++;
    }

    return currentBoard;
}

export const MemoryGame = ({ onWin, onRestart }: { onWin?: () => void, onRestart?: () => void }) => {
    const [board, setBoard] = useState<Card[]>([]);
    const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
    const [moves, setMoves] = useState(0);
    const [isLocked, setIsLocked] = useState(false);
    const [isGameWon, setIsGameWon] = useState(false);

    // Audio synths setup
    const playRumble = () => {
        // Optional internal rumble per click, or handled outside. Let's do a faint sub-bass click.
        try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContext) {
                const ctx = new AudioContext();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(RUMBLE_FREQ_START, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(RUMBLE_FREQ_END, ctx.currentTime + RUMBLE_DURATION);
                gain.gain.setValueAtTime(0.3, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + RUMBLE_DURATION);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + RUMBLE_DURATION);
            }
        } catch (e) {
            console.log('Audio init failed', e);
        }
    };

    const speakDutch = (text: string) => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel(); // stop previous
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'nl-NL';
            utterance.rate = 0.85; // slightly slowed, monolithic feel
            utterance.pitch = 0.8; // lower pitch
            window.speechSynthesis.speak(utterance);
        }
    };

    const initialiseGame = () => {
        setBoard(generateCleanBoard());
        setFlippedIndices([]);
        setMoves(0);
        setIsLocked(false);
        setIsGameWon(false);
    };

    const handleRestart = () => {
        initialiseGame();
        if (onRestart) onRestart();
    };

    useEffect(() => {
        initialiseGame();
    }, []);

    useEffect(() => {
        /* Checks the win condition */
        if (board.length > 0 && board.every((c) => c.isMatched)) {
            setTimeout(() => {
                setIsGameWon(true);
                if (onWin) onWin();
            }, WIN_TRANSITION_DELAY_MS);
        }
    }, [board, onWin]);

    const handleCardClick = (index: number) => {
        // Prevent interaction if locked, already flipped, or already matched
        if (isLocked || board[index].isFlipped || board[index].isMatched) return;

        playRumble();

        if (board[index].isDutch) {
            speakDutch(board[index].word);
        }

        const newFlipped = [...flippedIndices, index];
        setFlippedIndices(newFlipped);

        // Optimistically show flip
        const newBoard = [...board];
        newBoard[index] = { ...newBoard[index], isFlipped: true };
        setBoard(newBoard);

        if (newFlipped.length === 2) {
            setIsLocked(true);
            const [firstIndex, secondIndex] = newFlipped;
            setMoves((prev) => prev + 1);

            if (board[firstIndex].matchId === board[secondIndex].matchId) {
                /* MATCH: Pulses a white glow, then locks the engraved state */
                setTimeout(() => {
                    setBoard((prev) => {
                        const updated = [...prev];
                        updated[firstIndex] = { ...updated[firstIndex], isMatched: true };
                        updated[secondIndex] = { ...updated[secondIndex], isMatched: true };
                        return updated;
                    });
                    setFlippedIndices([]);
                    setIsLocked(false);
                }, MATCH_PULSE_DURATION_MS);
            } else {
                /* MISMATCH: Holds the state briefly, then fades back to concrete */
                setTimeout(() => {
                    setBoard((prev) => {
                        const updated = [...prev];
                        updated[firstIndex] = { ...updated[firstIndex], isFlipped: false };
                        updated[secondIndex] = { ...updated[secondIndex], isFlipped: false };
                        return updated;
                    });
                    setFlippedIndices([]);
                    setIsLocked(false);
                }, MISMATCH_RESTORE_DURATION_MS);
            }
        }
    };

    if (isGameWon) {
        return (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-black/50 backdrop-blur-sm pointer-events-auto transition-opacity duration-1000">
                <h2 className="text-white text-4xl mb-4 tracking-[0.3em] font-light">COMPLETE</h2>
                <div className="text-gray-400 text-xl font-mono mb-12 tracking-widest">
                    MOVES: <span className="text-white font-bold">{moves}</span>
                </div>
                <button
                    onClick={handleRestart}
                    className="px-8 py-4 bg-[#1a1a1a] border border-[#333] text-[#aaa] font-mono tracking-widest uppercase hover:text-white hover:bg-[#222] hover:border-[#555] transition-all duration-300 shadow-[0_0_15px_rgba(0,0,0,0.8)] focus:outline-none"
                >
                    RESTART
                </button>
            </div>
        );
    }

    return (
        <div className="w-full max-w-[700px] aspect-[3/2] p-4 mx-auto pointer-events-auto">
            <div className="grid grid-cols-6 grid-rows-4 gap-2 w-full h-full">
                {board.map((card, index) => {
                    // Dynamic classes based on state
                    let baseClasses = "relative w-full h-full flex items-center justify-center text-center p-2 rounded-sm cursor-pointer transition-all duration-300 select-none overflow-hidden ";

                    if (card.isMatched) {
                        // Engraved state
                        baseClasses += "bg-[#222] text-[#666] shadow-[inset_0_2px_10px_rgba(0,0,0,0.8)] border border-[#333]";
                    } else if (card.isFlipped) {
                        // Flipped/Revealed state
                        baseClasses += "bg-[#2a2a2a] text-[#ddd] shadow-[0_0_10px_rgba(255,255,255,0.05)] border border-[#444] animate-digital-aberration";
                    } else {
                        // Raw concrete state (face down)
                        baseClasses += "bg-[#222] border border-[#333] shadow-[2px_2px_10px_rgba(0,0,0,0.5)] hover:bg-[#282828]";
                    }

                    return (
                        <div
                            key={card.id}
                            onClick={() => handleCardClick(index)}
                            className={baseClasses}
                            style={{
                                // Faint white glow pulse if it's currently flipped and about to be matched
                                boxShadow: (card.isFlipped && board[flippedIndices[0]]?.matchId === board[flippedIndices[1]]?.matchId) ? '0 0 15px rgba(255,255,255,0.4), inset 0 0 20px rgba(255,255,255,0.1)' : undefined
                            }}
                        >
                            {/* Text content only visible when flipped or matched */}
                            <span
                                className={`font-semibold tracking-wider font-mono transition-opacity duration-300 leading-tight text-center break-words ${card.isFlipped || card.isMatched ? 'opacity-100' : 'opacity-0'}`}
                                style={{ fontSize: card.word.length > 14 ? '0.6rem' : card.word.length > 10 ? '0.7rem' : '0.8rem' }}
                            >
                                {card.word}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
