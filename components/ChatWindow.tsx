import { Blob } from '@google/genai';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ai, getLiveConfig } from '../services/geminiService';
import { Message, ResponseMode, ScenarioType } from '../types';
import { shhh } from './models/shhh';

type LiveServerMessage = any;

const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;
const AUDIO_THRESHOLD = 5;
const VISUALISER_BAR_COUNT = 24;

interface ChatWindowProps {
  scenario: ScenarioType;
  onExit: () => void;
}

interface Suggestion {
  dutch: string;
  english: string;
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

const ChatWindow: React.FC<ChatWindowProps> = ({ scenario, onExit }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isBotSpeaking, setIsBotSpeaking] = useState(false);
  const [allSuggestions, setAllSuggestions] = useState<Suggestion[]>([]);
  const [visibleCount, setVisibleCount] = useState(0);
  const [whisperUnlocked, setWhisperUnlocked] = useState(false);
  const [responseMode, setResponseMode] = useState<ResponseMode>('review');
  const [draftTranscript, setDraftTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isFetchingWhispers, setIsFetchingWhispers] = useState(false);
  const [speechAvailable, setSpeechAvailable] = useState(true);
  const [manualInput, setManualInput] = useState('');
  const [suggestionMemory, setSuggestionMemory] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewReport, setReviewReport] = useState<any>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [sessionCounter, setSessionCounter] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<any>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const transcriptionRef = useRef({ user: '', bot: '', botSnapshot: '' });
  const recognitionRef = useRef<any>(null);
  const responseModeRef = useRef<ResponseMode>(responseMode);
  const speechRetryRef = useRef(0);
  const manualInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    responseModeRef.current = responseMode;
  }, [responseMode]);



  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior, block: 'end' });
    }
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const observer = new MutationObserver(() => scrollToBottom('smooth'));
    observer.observe(container, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [scrollToBottom]);

  useEffect(() => {
    const timer = setTimeout(() => scrollToBottom('auto'), 150);
    return () => clearTimeout(timer);
  }, [messages, draftTranscript, scrollToBottom]);

  useEffect(() => {
    if (whisperUnlocked && visibleCount < allSuggestions.length && !isFetchingWhispers && !isBotSpeaking) {
      const timer = window.setTimeout(() => {
        setVisibleCount(prev => prev + 1);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [whisperUnlocked, visibleCount, allSuggestions, isFetchingWhispers, isBotSpeaking]);

  useEffect(() => {
    const MAX_SPEECH_RETRIES = 3;
    try {
      if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
        const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'nl-NL';
        recognitionRef.current.onresult = (event: any) => {
          /* Successful result resets the retry counter */
          speechRetryRef.current = 0;
          let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
          }
          if (finalTranscript) setDraftTranscript(prev => (prev + ' ' + finalTranscript).trim());
        };
        recognitionRef.current.onstart = () => setIsRecording(true);
        recognitionRef.current.onend = () => setIsRecording(false);
        recognitionRef.current.onerror = (e: any) => {
          const errCode = e.error;
          if (errCode === 'network' || errCode === 'service-not-allowed') {
            /* Auto-retry on transient network errors.
             * Chrome's Web Speech API sends audio to Google's cloud
             * servers; local dev environments (VPN, firewall, DNS)
             * often block this. Retry a few times before falling
             * back to the manual text input. */
            speechRetryRef.current += 1;
            if (speechRetryRef.current <= MAX_SPEECH_RETRIES) {
              console.warn(`[Speech] Network error — retry ${speechRetryRef.current}/${MAX_SPEECH_RETRIES}`);
              setTimeout(() => {
                try { recognitionRef.current?.start(); } catch (_) { /* already started */ }
              }, speechRetryRef.current * 800);
              return;
            }
            /* Exhausted retries — fall back to text input */
            console.warn('[Speech] Retries exhausted — switching to manual text input');
            setSpeechAvailable(false);
            setIsRecording(false);
            setError(null); /* Clear any stale banner */
          } else if (errCode !== 'aborted' && errCode !== 'no-speech') {
            setError(`Spraakherkenning fout: ${errCode}`);
          }
        };
      } else {
        setSpeechAvailable(false);
      }
    } catch (err) {
      console.error("Speech Recognition setup error:", err);
      setSpeechAvailable(false);
    }
  }, []);

  const toggleRecording = () => {
    try {
      if (!recognitionRef.current || !speechAvailable) return;
      if (isRecording) {
        recognitionRef.current.stop();
      } else {
        speechRetryRef.current = 0;
        setDraftTranscript('');
        recognitionRef.current.start();
      }
    } catch (err) {
      setError("Fout bij starten opname.");
    }
  };

  const confirmSend = () => {
    try {
      /* Accept text from either the speech draft or the manual input fallback */
      const textToSend = (draftTranscript || manualInput).trim();
      if (!textToSend || !sessionRef.current) return;
      sessionRef.current.sendRealtimeInput({ text: textToSend });
      const msgId = `u-${Date.now()}`;
      setMessages(prev => [...prev, {
        id: msgId,
        sender: 'user',
        text: textToSend,
        timestamp: new Date()
      }]);
      fetch('/api/translate', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({text: textToSend})})
        .then(r => r.json())
        .then(d => {
           if (d.translatedText) {
             setMessages(prev => prev.map(m => m.id === msgId ? {...m, translation: d.translatedText} : m));
           }
        }).catch(err => console.error(err));
      setDraftTranscript('');
      setManualInput('');
      setVisibleCount(0);
      setIsFetchingWhispers(true);
      if (isRecording) recognitionRef.current.stop();
    } catch (err) {
      setError("Versturen mislukt.");
    }
  };

  const toggleWhispers = () => {
    setWhisperUnlocked(prev => !prev);
    if (!whisperUnlocked) setVisibleCount(0);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      /* When the manual text input is focused, don't intercept normal typing keys */
      const isTypingInInput = document.activeElement === manualInputRef.current;
      if ((e.code === 'KeyW' || e.key === 'w' || e.key === 'W') && !isRecording && !isTypingInInput) {
        e.preventDefault();
        toggleWhispers();
      }
      if (responseMode === 'review' && speechAvailable) {
        if (e.code === 'Space') { e.preventDefault(); toggleRecording(); }
        if (e.code === 'Enter' && draftTranscript.trim()) { e.preventDefault(); confirmSend(); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [responseMode, isRecording, draftTranscript, whisperUnlocked, allSuggestions, speechAvailable]);

  useEffect(() => {
    let checkInterval: number;
    let isMounted = true;
    let activeSession: any = null;
    const startLiveSession = async () => {
      try {
        setError(null);
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          });
        } catch (mediaErr) {
          setError("Microfoontoegang geweigerd. Activeer de microfoon om de nacht te betreden.");
          return;
        }
        if (!inputAudioCtxRef.current) {
          inputAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: INPUT_SAMPLE_RATE });
        }
        if (!outputAudioCtxRef.current) {
          outputAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: OUTPUT_SAMPLE_RATE });
        }

        const liveConfig = getLiveConfig(scenario);
        activeSession = await (ai.live.connect({
          model: liveConfig.model,
          callbacks: {
            onopen: () => {
              if (!isMounted) { activeSession?.close(); return; }
              setIsLive(true);
              const source = inputAudioCtxRef.current!.createMediaStreamSource(stream);
              const scriptProcessor = inputAudioCtxRef.current!.createScriptProcessor(4096, 1, 1);
              scriptProcessor.onaudioprocess = (e) => {
                try {
                  const inputData = e.inputBuffer.getChannelData(0);
                  const sum = inputData.reduce((a, b) => a + Math.abs(b), 0);
                  const level = (sum / inputData.length) * 1000;
                  setAudioLevel(Math.min(level, 100));

                  /* Only send mic audio when the bot is NOT speaking.
                   * This prevents echo feedback where the bot hears its
                   * own speaker output via the mic and talks to itself. */
                  const botPlaying = outputAudioCtxRef.current
                    ? nextStartTimeRef.current > outputAudioCtxRef.current.currentTime
                    : false;

                  if (responseModeRef.current === 'instant' && activeSession && !botPlaying) {
                    activeSession.sendRealtimeInput({ audio: createBlob(inputData) });
                  }
                } catch (err) {
                  console.error("Audio processor error:", err);
                }
              };
              source.connect(scriptProcessor);
              scriptProcessor.connect(inputAudioCtxRef.current!.destination);

              checkInterval = window.setInterval(() => {
                let playing = false;
                if (outputAudioCtxRef.current) {
                  const ct = outputAudioCtxRef.current.currentTime;
                  if (nextStartTimeRef.current > ct) {
                    playing = true;
                  }
                }
                setIsBotSpeaking(playing);
              }, 100);

              // Start prompt is sent after the await resolves below.
            },
            onmessage: async (message: LiveServerMessage) => {
              try {
                if (message.toolCall) {
                  /* Snapshot the clean transcription BEFORE the tool call.
                   * The native audio model sometimes speaks tool-call metadata
                   * aloud (e.g. 'eliminated_suggestion_details', Chinese text).
                   * Freezing the transcript here prevents that noise from
                   * appearing in the chat. */
                  transcriptionRef.current.botSnapshot = transcriptionRef.current.bot;

                  for (const fc of message.toolCall.functionCalls) {
                    if (fc.name === 'evaluateUserSpeech' || fc.name === 'provideSuggestions') {
                      const args = fc.args as any;
                      /* Apply corrections in a single state update */
                      setMessages(prev => {
                        const updated = [...prev];
                        if (args.isUserCorrect !== undefined) {
                          const lastUserIdx = [...updated].reverse().findIndex(m => m.sender === 'user');
                          if (lastUserIdx !== -1) {
                            const idx = updated.length - 1 - lastUserIdx;
                            updated[idx] = { ...updated[idx], isCorrect: args.isUserCorrect };
                          }
                        }
                        return updated;
                      });
                      /* Properly structured tool response array prevents connection errors */
                      activeSession?.sendToolResponse({
                        functionResponses: [{ id: fc.id, name: fc.name, response: { result: "suggestions received" } }]
                      });
                    }
                  }
                }

                if (message.serverContent?.modelTurn) {
                  setVisibleCount(0);
                  setIsFetchingWhispers(true);
                }

                if (message.serverContent?.inputTranscription) {
                  transcriptionRef.current.user += message.serverContent.inputTranscription.text;
                  // Synchronise the live transcription with the UI draft in instant mode
                  if (responseModeRef.current === 'instant') {
                    setDraftTranscript(transcriptionRef.current.user);
                  }
                }
                if (message.serverContent?.outputTranscription) transcriptionRef.current.bot += message.serverContent.outputTranscription.text;

                const audioBase64 = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                if (audioBase64 && outputAudioCtxRef.current) {
                  try {
                    const ctx = outputAudioCtxRef.current;
                    nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                    const buffer = await decodeAudioData(decode(audioBase64), ctx, OUTPUT_SAMPLE_RATE, 1);
                    const source = ctx.createBufferSource();
                    source.buffer = buffer; source.connect(ctx.destination);
                    source.addEventListener('ended', () => sourcesRef.current.delete(source));
                    source.start(nextStartTimeRef.current);
                    nextStartTimeRef.current += buffer.duration;
                    sourcesRef.current.add(source);
                  } catch (audioErr) {
                    console.error("Audio playback error:", audioErr);
                  }
                }

                if (message.serverContent?.turnComplete) {
                  /* Use the snapshot (pre-tool-call) if available, otherwise the full transcript */
                  const rawBot = (transcriptionRef.current.botSnapshot || transcriptionRef.current.bot).trim();
                  const userTextRaw = transcriptionRef.current.user.trim();

                  /* Clean up model noise: tool-call metadata that leaked into audio */
                  const botText = rawBot
                    .replace(/eliminated_suggestion_details/gi, '')
                    .replace(/提供的建议/g, '')
                    .replace(/`?(provideSuggestions|evaluateUserSpeech)`?[\s\S]*/gi, '')
                    .replace(/isUserCorrect[\s\S]*/gi, '')
                    .replace(/suggestions_?[=:]?[\s\S]*/gi, '')
                    .replace(/\[\{['"]dutch['"][\s\S]*/gi, '')
                    .replace(/\d+\.\s*$/gm, '')  /* trailing numbered list fragments */
                    .replace(/\s{2,}/g, ' ')      /* collapse multiple spaces */
                    .trim();

                  if (responseModeRef.current === 'instant' && userTextRaw) {
                    const msgId = `u-${Date.now()}`;
                    setMessages(prev => [...prev, { id: msgId, sender: 'user', text: userTextRaw, timestamp: new Date() }]);
                    fetch('/api/translate', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({text: userTextRaw})})
                      .then(r => r.json())
                      .then(d => {
                         if (d.translatedText) {
                           setMessages(prev => prev.map(m => m.id === msgId ? {...m, translation: d.translatedText} : m));
                         }
                      }).catch(err => console.error(err));

                    // Clear the temporary draft transcription now that the turn is complete
                    setDraftTranscript('');
                  }
                  if (botText) {
                    const msgId = `a-${Date.now()}`;
                    setMessages(prev => [...prev, { id: msgId, sender: scenario === ScenarioType.COMPREHENSION ? 'narrator' : 'apparition', text: botText, timestamp: new Date() }]);
                    fetch('/api/translate', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({text: botText})})
                      .then(r => r.json())
                      .then(d => {
                         if (d.translatedText) {
                           setMessages(prev => prev.map(m => m.id === msgId ? {...m, translation: d.translatedText} : m));
                         }
                      }).catch(err => console.error(err));
                    
                    shhh.getWhispers(botText, scenario, suggestionMemory ? messages : undefined).then(suggestions => {
                      if (suggestions && suggestions.length > 0) {
                        setAllSuggestions(suggestions);
                      }
                      setIsFetchingWhispers(false);
                    }).catch(e => {
                      console.error("Whisper error:", e);
                      setIsFetchingWhispers(false);
                    });
                  } else {
                    setIsFetchingWhispers(false);
                  }
                  transcriptionRef.current = { user: '', bot: '', botSnapshot: '' };
                }

                if (message.serverContent?.interrupted) {
                  sourcesRef.current.forEach(s => s.stop()); sourcesRef.current.clear();
                  nextStartTimeRef.current = 0;
                  setIsBotSpeaking(false);
                  setIsFetchingWhispers(false);

                  // Reset the draft if the interaction is unexpectedly interrupted
                  if (responseModeRef.current === 'instant') {
                    setDraftTranscript('');
                  }
                }
              } catch (err) {
                console.error("Message handling error:", err);
              }
            },
            onerror: (e) => {
              console.error("Live API Error:", e);
              setError("API Connectie mislukt. (Is je API key correct en lokaal ingesteld?)");
            },
            onclose: () => setIsLive(false),
          },
          config: liveConfig.config,
        }) as Promise<any>);

        if (isMounted) {
          sessionRef.current = activeSession;
          /* 
           * Backend triggers the AI greeting immediately after connection.
           * No need to send a start prompt from the frontend.
           */
        } else {
          activeSession?.close();
        }
      } catch (err: any) {
        if (isMounted) {
          setError(`Connectie mislukt: ${err.message || 'Onbekende fout'}`);
          setIsLive(false);
        }
      }
    };
    startLiveSession();
    return () => {
      isMounted = false;
      clearInterval(checkInterval);
      activeSession?.close();
      sessionRef.current = null;
    };
  }, [scenario, sessionCounter]);

  const restartSession = () => {
    setMessages([]);
    setDraftTranscript('');
    setManualInput('');
    setAllSuggestions([]);
    setVisibleCount(0);
    setWhisperUnlocked(false);
    transcriptionRef.current = { user: '', bot: '', botSnapshot: '' };
    
    // Close existing connection
    if (sessionRef.current) {
      try {
        sessionRef.current.close();
      } catch(e) {}
      sessionRef.current = null;
    }
    
    // Trigger reconnection
    setSessionCounter(prev => prev + 1);
  };

  const endAndReview = async () => {
    setIsReviewing(true);
    setShowReviewModal(true);
    try {
      const response = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_history: messages.map(m => ({ sender: m.sender, text: m.text })),
          scenario: scenario
        })
      });
      if (!response.ok) throw new Error("Review fetch failed");
      const data = await response.json();
      setReviewReport(data);
    } catch (err) {
      console.error(err);
      // Let modal handle empty or error states
    } finally {
      setIsReviewing(false);
    }
  };

  const getPersonaName = () => {
    if (scenario === ScenarioType.INTRO) return 'Lotte';
    if (scenario === ScenarioType.COFFEE) return 'Sanne';
    if (scenario === ScenarioType.COMPREHENSION) return 'De Schaduw';
    return 'De Stem';
  };

  const getPersonaImage = () => {
    if (scenario === ScenarioType.INTRO) return '/persona_intro.png';
    if (scenario === ScenarioType.COFFEE) return '/persona_coffee.png';
    if (scenario === ScenarioType.COMPREHENSION) return '/persona_comprehension.png';
    return '/persona_freespeech.png';
  };

  return (
    <div className="flex h-screen w-full relative selection:bg-white/20 selection:text-white bg-[#050505] text-white font-body overflow-hidden">

      {/* Dynamic Persona Background Layer */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div
          className={`absolute top-0 right-0 w-[100%] md:w-[80%] h-full bg-cover bg-center transition-all duration-1000 ease-out 
            ${isBotSpeaking ? 'opacity-100 scale-105 filter brightness-110 blur-none' : 'opacity-70 scale-100 filter brightness-90 blur-none'}`}
          style={{ backgroundImage: `url(${getPersonaImage()})` }}
        />
        {/* Gradients to fade out the image into the editorial background */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-[#050505]/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent opacity-60" />
      </div>

      {/* Error Overlay */}
      {error && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 z-[100] bg-black/80 backdrop-blur-xl border border-red-900/30 px-8 py-4 shadow-2xl animate-in fade-in slide-in-from-top-8 duration-700 min-w-[300px]">
          <div className="flex items-center gap-6">
            <div className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
            <span className="text-gray-300 text-[10px] uppercase tracking-[0.3em] font-light flex-1">{error}</span>
            <button onClick={() => setError(null)} className="text-gray-400 hover:text-white transition-colors text-[9px] uppercase tracking-widest pl-4 border-l border-white/10">CLOSE</button>
          </div>
        </div>
      )}

      {/* Review Modal Overlap */}
      {showReviewModal && (
        <div className="absolute inset-0 z-[200] bg-black/98 backdrop-blur-md flex items-center justify-center p-4 md:p-8">
          <div className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-[#0a0a0a] border border-[#222] relative animate-in fade-in slide-in-from-bottom-8 duration-700">
            {/* Header + Close button */}
            <div className="flex items-center justify-between p-8 md:p-10 border-b border-[#222] shrink-0">
               <div>
                 <h2 className="font-display font-bold text-3xl md:text-5xl text-white tracking-tighter uppercase relative"><span className="absolute -left-6 top-2 w-2 h-2 bg-white rounded-full"></span>Session Report</h2>
                 <p className="text-[#888] text-[11px] uppercase tracking-[0.3em] font-bold mt-2">Grammatical Evaluation</p>
               </div>
               <button 
                onClick={() => setShowReviewModal(false)}
                className="text-[10px] uppercase tracking-widest text-[#555] hover:text-white transition-all border-b border-transparent hover:border-white"
               >
                 CLOSE
               </button>
            </div>
            
            <div className="p-8 md:p-10 overflow-y-auto custom-scrollbar flex-1">
            {isReviewing ? (
              <div className="py-20 flex flex-col items-center justify-center gap-6">
                <div className="w-3 h-3 bg-white rounded-full animate-ping" />
                <span className="text-[10px] uppercase tracking-[0.4em] font-bold text-[#666]">Analysing...</span>
              </div>
            ) : reviewReport?.error ? (
              <div className="py-10 text-center text-red-500 font-medium">The review could not be completed: {reviewReport.error}</div>
            ) : reviewReport?.summary ? (
              <div className="space-y-6 pb-4">
                <div className="mb-10 text-gray-300 font-body text-xl md:text-2xl tracking-tight leading-relaxed whitespace-pre-wrap border-l-2 border-[#555] pl-6 md:pl-8 italic">
                  {reviewReport.summary}
                </div>

                {reviewReport.topic_suggestions && reviewReport.topic_suggestions.length > 0 && (
                  <div className="mt-12 pt-8 border-t border-[#222]">
                    <h3 className="font-display font-bold text-xl text-white tracking-tighter mb-6 uppercase relative"><span className="absolute -left-4 top-2 w-1.5 h-1.5 bg-[#555] rounded-full"></span>Other Useful Phrases</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       {reviewReport.topic_suggestions.map((suggestion: any, sIdx: number) => (
                         <div key={`ts-${sIdx}`} className="bg-[#111] p-4 border border-[#222] hover:border-white transition-colors cursor-default">
                           <div className="text-white font-body font-bold text-lg mb-1 tracking-tight">"{suggestion.dutch}"</div>
                           <div className="text-[#888] text-[9.5px] uppercase tracking-widest border-t border-[#222] pt-3 leading-relaxed font-bold">EN: {suggestion.english}</div>
                         </div>
                       ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-10 text-center text-[#555]">No data available. Try again.</div>
            )}
            </div>
          </div>
        </div>
      )}

      {/* Main Chat Layout Area (Matching Landing Aesthetic) */}
      <div className="flex flex-col flex-1 relative z-10 w-full md:w-3/4 mx-auto md:mx-0 md:mr-[25%] h-full">

        {/* Sticky Header */}
        <div className="flex items-center justify-between px-8 md:px-12 py-8 bg-gradient-to-b from-[#050505] via-[#050505]/80 to-transparent">
          <div className="flex items-center gap-4">
            <div className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-white animate-pulse' : 'bg-red-900'}`} />
            <span className="text-[10px] uppercase tracking-[0.3em] font-light text-[#888888]">
              {isLive ? `${scenario === ScenarioType.COMPREHENSION ? 'STORY' : 'CONVERSATION'}` : 'OFFLINE'}
            </span>
          </div>
          <div className="flex items-center gap-8">
            <div className="flex bg-white/5 p-0.5 rounded-sm overflow-hidden border border-white/10">
              <button onClick={() => { setResponseMode('instant'); setDraftTranscript(''); }} className={`px-4 py-1.5 text-[9px] uppercase tracking-widest transition-all ${responseMode === 'instant' ? 'bg-white text-black font-medium' : 'text-gray-500 hover:text-gray-300'}`}>Instant</button>
              <button onClick={() => setResponseMode('review')} className={`px-4 py-1.5 text-[9px] uppercase tracking-widest transition-all ${responseMode === 'review' ? 'bg-white text-black font-medium' : 'text-gray-500 hover:text-gray-300'}`}>Reflection</button>
            </div>
            <button onClick={onExit} className="text-[10px] uppercase tracking-[0.2em] font-bold border-b border-transparent hover:border-[#888888] text-[#888888] hover:text-white transition-all">EXIT</button>
          </div>
        </div>

        {/* Scrollable Chat Area */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto px-8 md:px-12 pb-10 space-y-24 scroll-smooth scrollbar-hide pt-12"
        >
          {messages.length === 0 && isLive && !error && (
            <div className="text-left py-40 animate-pulse">
              <p className="font-display font-bold text-4xl md:text-6xl text-white/30 tracking-tighter mix-blend-overlay">CONNECTING...</p>
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-8 duration-1000 group`}>
              <div className={`max-w-[85%] md:max-w-[70%] ${msg.sender === 'user' ? 'text-right' : 'text-left'} relative`}>
                <div className={`font-medium text-2xl md:text-4xl leading-[1.2] tracking-tighter ${msg.sender === 'user' ? 'text-gray-300' : msg.sender === 'narrator' ? 'italic text-[#888888]' : 'text-white'}`}>
                  {msg.text}
                </div>
                {msg.translation && (
                  <div className={`mt-3 text-[9px] md:text-[10px] uppercase tracking-[0.2em] font-bold opacity-70 ${msg.sender === 'user' ? 'text-gray-500' : 'text-[#888888]'} bg-[#111] px-4 py-2 rounded border-l-2 ${msg.sender === 'user' ? 'border-[#333]' : 'border-white/20'}`}>
                    EN: {msg.translation}
                  </div>
                )}
                {msg.sender === 'user' && msg.isCorrect !== undefined && (
                  <div className="mt-4 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity duration-700">
                    <div className="flex items-center gap-2">
                      <div className={`w-1 h-1 rounded-full ${msg.isCorrect ? 'bg-white/70' : 'bg-orange-500/70'}`} />
                      <span className={`text-[8px] uppercase tracking-[0.3em] font-medium ${msg.isCorrect ? 'text-white/80' : 'text-orange-500/80'}`}>{msg.isCorrect ? 'Accurate' : 'No Match'}</span>
                    </div>
                  </div>
                )}
                <span className="text-[9px] w-full uppercase tracking-[0.4em] text-[#555555] mt-6 block font-bold border-t border-[#222222] pt-4">
                  <span className={msg.sender === 'user' ? 'float-right' : 'float-left'}>{msg.sender === 'user' ? 'GUEST' : getPersonaName().toUpperCase()}</span>
                </span>
                <div className="clear-both" />
              </div>
            </div>
          ))}
          {draftTranscript && (
            <div className="flex justify-end animate-in slide-in-from-right-8 duration-500">
              <div className="max-w-[85%] md:max-w-[70%] text-right">
                <div className={`text-white italic text-2xl md:text-3xl font-light pr-6 py-2 border-r border-[#444] ${isRecording ? 'opacity-80 animate-pulse' : 'opacity-40'}`}>"{draftTranscript}"</div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} className="h-40" />
        </div>

        {/* CONTROLS & VISUALISER (Brutalist Footer) */}
        <div className="px-8 md:px-12 pb-12 pt-10 flex flex-col items-start gap-6 relative z-10 border-t border-[#111111]/30 bg-gradient-to-t from-[#050505] via-[#050505]/80 to-transparent">
          {responseMode === 'review' ? (
            speechAvailable ? (
              <div className="flex items-center gap-6">
                <button onClick={toggleRecording} className={`group px-8 py-3 transition-colors duration-500 flex items-center gap-4 ${isRecording ? 'bg-white text-black' : 'bg-transparent border border-[#333] text-white hover:bg-white/10'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${isRecording ? 'bg-black animate-ping' : 'bg-white'}`} />
                  <span className="text-[10px] uppercase tracking-[0.3em] font-bold">{isRecording ? 'STOP' : 'RECORD'}</span>
                </button>
                {draftTranscript.trim() && (
                  <button onClick={confirmSend} className="px-8 py-3 bg-white text-black hover:bg-gray-200 transition-colors duration-500">
                    <span className="text-[10px] uppercase tracking-[0.3em] font-bold">SEND</span>
                  </button>
                )}
              </div>
            ) : (
              /* Manual text input fallback when Web Speech API is unavailable */
              <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="flex-1 md:flex-none flex items-center gap-3 border border-[#333] bg-transparent px-4 py-2 min-w-[300px] focus-within:border-white/40 transition-colors">
                  <div className="w-1.5 h-1.5 bg-[#555]" />
                  <input
                    ref={manualInputRef}
                    type="text"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && manualInput.trim()) { e.preventDefault(); confirmSend(); } }}
                    placeholder="Type je antwoord in het Nederlands..."
                    className="bg-transparent text-white text-sm font-light tracking-wide outline-none flex-1 placeholder:text-[#444] placeholder:tracking-wider"
                    autoFocus
                  />
                </div>
                {manualInput.trim() && (
                  <button onClick={confirmSend} className="px-8 py-3 bg-white text-black hover:bg-gray-200 transition-colors duration-500 shrink-0">
                    <span className="text-[10px] uppercase tracking-[0.3em] font-bold">SEND</span>
                  </button>
                )}
              </div>
            )
          ) : (
            <div className="flex items-end gap-1.5 h-10 w-full md:w-auto">
              {/* Brutalist SPEECH VISUALISER BARS */}
              {[...Array(VISUALISER_BAR_COUNT)].map((_, i) => {
                const height = Math.max(2, (audioLevel / 100) * 40 * (1 - Math.abs(i - 11) / 12));
                return (
                  <div
                    key={i}
                    className={`w-[4px] transition-all duration-75 bg-white ${audioLevel > AUDIO_THRESHOLD ? 'opacity-100' : 'opacity-10'}`}
                    style={{ height: `${height}px` }}
                  />
                );
              })}
            </div>
          )}

          <div className="text-[9px] uppercase tracking-[0.5em] text-[#666] flex items-center gap-4 mt-2 font-bold w-full justify-between md:w-auto md:justify-start">
            <div className="flex items-center gap-4 border-r border-[#333] pr-6">
              <div className={`w-1.5 h-1.5 ${isRecording || audioLevel > AUDIO_THRESHOLD ? 'bg-white' : 'bg-[#333]'}`} />
              {responseMode === 'review'
                ? (speechAvailable
                    ? (isRecording ? 'LISTENING...' : 'WAITING...')
                    : (manualInput.trim() ? 'READY TO SEND' : 'TYPE TO RESPOND'))
                : (audioLevel > AUDIO_THRESHOLD ? 'INPUT ACTIVE' : 'AWAITING INPUT')}
            </div>
            <span className="md:border-none pl-2 md:pl-0">{responseMode === 'review' && !speechAvailable ? 'TEXT / MANUAL' : 'MIC / DIRECT'}</span>
          </div>
        </div>
      </div>

      {/* WHISPERS SIDEBAR (Right Absolute Drawer) */}
      <div className="absolute top-0 right-0 h-full w-full md:w-1/4 bg-[#0a0a0a]/40 backdrop-blur-md border-l border-[#111111]/50 hidden md:flex flex-col z-50">

        {/* Toggle Button */}
        <div className="px-8 py-10 border-b border-[#111]">
          <button
            onClick={toggleWhispers}
            className={`group w-full py-5 border transition-all duration-700 flex items-center justify-center relative ${whisperUnlocked
              ? 'border-white bg-white text-black'
              : allSuggestions.length > 0
                ? 'border-[#555] text-white hover:border-white hover:bg-white/5'
                : 'border-[#222] text-[#444] cursor-not-allowed'
              }`}
          >
            <span className={`text-[11px] uppercase tracking-[0.3em] font-bold pl-3 transition-colors ${whisperUnlocked ? 'text-black' : 'text-white'}`}>
              {whisperUnlocked ? 'SIGNAL FOUND' : 'SHH'}
            </span>
            {!whisperUnlocked && allSuggestions.length > 0 && (
              <div className="absolute top-3 right-3">
                <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
              </div>
            )}
            <div className={`absolute bottom-[-20px] left-1/2 -translate-x-1/2 transition-opacity duration-1000 ${allSuggestions.length > 0 && !whisperUnlocked ? 'opacity-100' : 'opacity-0'}`}>
              <span className="text-[8px] uppercase tracking-widest text-[#555] whitespace-nowrap">{allSuggestions.length} UNREAD</span>
            </div>
          </button>
        </div>

        {/* Suggestions List */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-5 scrollbar-hide bg-gradient-to-b from-transparent to-[#050505]/80">
          <div className="text-[9px] font-bold uppercase tracking-[0.5em] text-[#444] mb-6 flex justify-between">
            <span>WHISPERS</span>
            <span>[W]</span>
          </div>

          {whisperUnlocked ? (
            allSuggestions.length > 0 ? (
              allSuggestions.map((s, idx) => (
                <div key={idx} className={`transition-all duration-700 transform ${idx < visibleCount ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'}`}>
                  <div className="bg-[#050505] px-5 py-4 group hover:bg-[#111] transition-colors cursor-crosshair border-l border-transparent hover:border-white">
                    <div className="font-body font-bold text-lg md:text-xl text-gray-300 tracking-tight mb-3 leading-[1.2] group-hover:text-white transition-colors">
                      "{s.dutch}"
                    </div>
                    <div className="font-display text-[9px] text-[#555] uppercase tracking-[0.2em] font-bold pt-2 group-hover:text-gray-400 transition-colors border-t border-[#111] group-hover:border-[#333]">
                      EN: {s.english}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-[10px] uppercase tracking-[0.4em] text-[#333] py-20 text-center leading-relaxed font-display font-bold">
                SILENCE.
              </div>
            )
          ) : (
            <div className="h-full flex flex-col items-center justify-center pb-32 opacity-20 hover:opacity-100 transition-opacity duration-1000 cursor-pointer" onClick={toggleWhispers}>
              <span className="text-[5vw] font-display font-bold mix-blend-overlay">?</span>
            </div>
          )}
        </div>

        {/* Lower Control Bar */}
        <div className="border-t border-[#111] bg-[#050505] flex items-center h-16">
          <button onClick={restartSession} className="flex-1 h-full text-[9px] uppercase tracking-[0.2em] font-bold text-[#666] hover:text-white hover:bg-white/5 transition-all outline-none flex items-center justify-center">
            RESTART
          </button>

          {scenario !== ScenarioType.COMPREHENSION && (
            <>
              <div className="w-[1px] h-8 bg-[#111]" />
              
              <button 
                onClick={endAndReview} 
                disabled={isReviewing} 
                className="flex-1 h-full text-[9px] uppercase tracking-[0.2em] font-bold text-[#666] hover:text-white hover:bg-white/5 transition-all outline-none flex items-center justify-center gap-2"
              >
                {isReviewing ? 'REVIEWING...' : 'REVIEW'}
              </button>

              <div className="w-[1px] h-8 bg-[#111]" />
              
              <button 
                onClick={() => setSuggestionMemory(!suggestionMemory)}
                className="flex-1 h-full text-[9px] uppercase tracking-[0.2em] font-bold text-[#666] hover:text-white hover:bg-white/5 transition-all outline-none flex items-center justify-center"
              >
                MEMORY: {suggestionMemory ? 'ON' : 'OFF'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;
