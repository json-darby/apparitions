import React, { useEffect, useRef, useState } from 'react';
import { ScenarioType } from '../../types';
import CandleIcon from './CandleIcon';
import { Phrase, Register, RegisterText, VOTIVE_SCENES, pickRegister } from './phrases';

interface VotivePanelProps {
  scenario: ScenarioType;
  open: boolean;
  onClose: () => void;
  /** Drops a phrase into the player's reply box. */
  onUse: (text: string) => void;
}

/** How long the old register takes to fade before the new one fades in. */
const FADE_MS = 220;
/** Delay between phrase rows appearing, for the cascade. */
const ROW_STAGGER_MS = 28;

const SLOT = /\{([^}]+)\}/g;
/** A phrase as it should be said or typed: slot markers dropped, example words kept. */
const plain = (text: string) => text.replace(SLOT, '$1');

/** Renders **bold** and `code` inside advice, notes and grammar tips. */
function rich(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/).map((part, i) => {
    if (part.startsWith('**')) return <b key={i} className="text-white font-semibold">{part.slice(2, -2)}</b>;
    if (part.startsWith('`')) return <code key={i} className="font-mono text-[11.5px] text-white bg-[#161616] px-1">{part.slice(1, -1)}</code>;
    return part;
  });
}

/** A phrase with its swap-in words underlined as slots. */
function withSlots(text: string, key: string | number) {
  return text.split(SLOT).map((part, i) =>
    i % 2 === 1
      ? <span key={`${key}-${i}`} className="border-b border-dashed border-[#666] text-[#8a8a8a] font-normal">{part}</span>
      : <React.Fragment key={`${key}-${i}`}>{part}</React.Fragment>
  );
}

/**
 * Underlines the words that differ from the other register, right after a switch,
 * so flipping jij/u teaches the difference instead of just swapping text.
 */
function markChanges(text: RegisterText, register: Register, flash: boolean) {
  const shown = pickRegister(text, register);
  if (!flash || typeof text === 'string') return withSlots(shown, 'p');
  /* Compare bare words, so "cappuccino." and "cappuccino" count as the same. */
  const bare = (word: string) => word.toLowerCase().replace(/[.,!?…]/g, '');
  const other = new Set(pickRegister(text, register === 'jij' ? 'u' : 'jij').split(/\s+/).map(bare));
  return shown.split(/(\s+)/).map((word, i) =>
    /\s/.test(word) || other.has(bare(word))
      ? <React.Fragment key={i}>{withSlots(word, i)}</React.Fragment>
      : <span key={i} className="votive-shift">{withSlots(word, i)}</span>
  );
}

const SpeakerIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3" aria-hidden>
    <path d="M4 9v6h4l5 4V5L8 9H4z" /><path d="M16.5 8.5a5 5 0 0 1 0 7" />
  </svg>
);
const UseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3" aria-hidden>
    <path d="M5 5v8a3 3 0 0 0 3 3h11" /><path d="M15 12l4 4-4 4" />
  </svg>
);

const ACTION_BUTTON = 'w-7 h-[26px] border border-[#2a2a2a] grid place-items-center text-[#aaa] hover:bg-white hover:text-black hover:border-white transition-colors';

/**
 * Votive: a candle in every conversation. Opens the phrases that scene needs,
 * with an informal (jij) / formal (u) switch. Each phrase can be heard aloud or
 * dropped into the reply box to edit and send.
 */
const VotivePanel: React.FC<VotivePanelProps> = ({ scenario, open, onClose, onUse }) => {
  const scene = VOTIVE_SCENES[scenario];
  const [register, setRegister] = useState<Register>('jij');
  const [shown, setShown] = useState<Register>('jij');
  const [fading, setFading] = useState(false);
  const [flash, setFlash] = useState(false);
  const [switchCount, setSwitchCount] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const switchTo = (next: Register) => {
    if (next === register) return;
    setRegister(next);
    setFading(true);
    window.setTimeout(() => {
      setShown(next);
      setFlash(true);
      setSwitchCount(n => n + 1);
      setFading(false);
    }, FADE_MS);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  /* Stop any phrase still playing when the panel closes or the view goes away. */
  useEffect(() => {
    if (!open) audioRef.current?.pause();
  }, [open]);
  useEffect(() => () => audioRef.current?.pause(), []);

  const hear = async (text: string) => {
    try {
      audioRef.current?.pause();
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: plain(text) }),
      });
      if (!response.ok) return;
      const audio = new Audio(URL.createObjectURL(await response.blob()));
      audioRef.current = audio;
      await audio.play();
    } catch (err) {
      console.error('[Votive] Could not play phrase:', err);
    }
  };

  let row = 0;
  const phraseRow = (phrase: Phrase, key: string) => {
    const nl = pickRegister(phrase.nl, shown);
    return (
      <div
        key={key}
        className="votive-row group flex gap-3 items-start py-3 pl-3 border-l border-transparent border-b border-b-[#0f0f0f] hover:bg-[#0d0d0d] hover:border-l-white transition-colors"
        style={{ animationDelay: `${(row++) * ROW_STAGGER_MS}ms` }}
      >
        <div className="flex-1 min-w-0">
          <div className="text-[15px] md:text-base font-semibold tracking-tight leading-snug text-[#e8e8e8] break-words">
            {markChanges(phrase.nl, shown, flash)}
          </div>
          <div className="mt-1.5 text-[9px] tracking-[0.18em] uppercase font-bold text-[#666] break-words">
            EN: {pickRegister(phrase.en, shown)}
          </div>
          {phrase.note && <div className="mt-1.5 text-[11px] leading-relaxed text-[#777]">{rich(phrase.note)}</div>}
        </div>
        <div className="flex gap-1 shrink-0 opacity-60 md:opacity-35 group-hover:opacity-100 transition-opacity">
          <button onClick={() => hear(nl)} className={ACTION_BUTTON} aria-label="Hear it" title="Hear it"><SpeakerIcon /></button>
          <button onClick={() => onUse(plain(nl))} className={ACTION_BUTTON} aria-label="Use in reply" title="Use in reply"><UseIcon /></button>
        </div>
      </div>
    );
  };

  return (
    <>
      <style>{`
        @keyframes votive-rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        @keyframes votive-flash { from { background: rgba(255,255,255,0.25); } to { background: transparent; } }
        .votive-row { opacity: 0; animation: votive-rise 500ms cubic-bezier(.2,.8,.2,1) forwards; }
        .votive-shift { box-shadow: inset 0 -1px 0 rgba(255,255,255,0.55); animation: votive-flash 1.6s ease-out; }
      `}</style>

      {/* Veil over the conversation */}
      <div
        onClick={onClose}
        className={`absolute inset-0 z-[80] bg-black/70 transition-opacity duration-500 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      />

      <aside
        aria-hidden={!open}
        className={`absolute z-[90] bg-[#070707] flex flex-col font-body transition-transform duration-[600ms] ease-[cubic-bezier(.2,.8,.2,1)]
          inset-x-0 bottom-0 top-[64px] border-t border-[#222]
          md:top-0 md:right-auto md:w-[500px] md:border-t-0 md:border-r md:border-[#1e1e1e]
          ${open ? 'translate-y-0 md:translate-x-0' : 'translate-y-[102%] md:translate-y-0 md:-translate-x-[102%]'}`}
      >
        {/* Title bar */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-4 md:px-9 md:pt-8 border-b border-[#141414]">
          <div className="w-[30px] h-7 border border-white bg-white text-black grid place-items-center shrink-0"><CandleIcon /></div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display font-bold text-[22px] tracking-tighter leading-none text-white">VOTIVE</h2>
            <div className="mt-1.5 font-mono text-[9px] tracking-[0.25em] uppercase text-[#666] truncate">{scene.code} / {scene.name} · {scene.place}</div>
          </div>
          <button onClick={onClose} className="font-mono text-[9px] tracking-[0.25em] uppercase text-[#666] hover:text-white pl-4 border-l border-[#222] self-stretch flex items-center transition-colors">
            Close
          </button>
        </div>

        {/* Register switch + advice */}
        <div className="relative z-[2] bg-[#070707] px-5 pt-3.5 pb-3 md:px-9 md:pt-4 border-b border-[#111]">
          <div className="relative grid grid-cols-2 bg-white/[0.04] border border-white/10 p-0.5 font-mono">
            <div
              className="absolute top-0.5 bottom-0.5 left-0.5 w-[calc(50%-2px)] bg-white transition-transform duration-[450ms] ease-[cubic-bezier(.2,.8,.2,1)]"
              style={{ transform: register === 'u' ? 'translateX(100%)' : 'none' }}
            />
            {(['jij', 'u'] as Register[]).map(r => (
              <button
                key={r}
                onClick={() => switchTo(r)}
                className={`relative z-[1] py-2 flex justify-center items-baseline gap-2 text-[9px] tracking-[0.22em] uppercase transition-colors duration-[450ms] ${register === r ? 'text-black' : 'text-[#666] hover:text-[#aaa]'}`}
              >
                {r === 'jij' ? 'Informal' : 'Formal'}
                <em className="not-italic font-body font-semibold text-xs tracking-normal normal-case">{r}</em>
              </button>
            ))}
          </div>
          <p
            className="mt-3 text-xs leading-relaxed text-[#9a9a9a] border-l-2 border-white/30 pl-3 min-h-[40px] transition-opacity"
            style={{ opacity: fading ? 0 : 1, transitionDuration: `${FADE_MS}ms` }}
          >
            {rich(scene.advice[shown])}
          </p>
        </div>

        {/* Phrases */}
        <div className="flex-1 overflow-y-auto px-5 pb-10 md:px-9 md:pb-12 scrollbar-hide">
          <div
            key={switchCount}
            className="transition-[opacity,filter,transform]"
            style={{
              transitionDuration: `${FADE_MS}ms`,
              opacity: fading ? 0 : 1,
              filter: fading ? 'blur(3px)' : 'none',
              transform: fading ? 'translateY(4px)' : 'none',
            }}
          >
            {scene.sections.map((section, s) => (
              <section key={s} className="mt-6">
                <div className="flex items-baseline justify-between gap-3 pb-2.5 border-b border-[#151515] text-[9px] tracking-[0.35em] uppercase font-bold text-[#555]">
                  <span>{section.title}</span>
                  <span className="tracking-[0.2em] font-normal text-[#3a3a3a] text-right">{section.subtitle}</span>
                </div>

                {section.phrases?.map((p, i) => phraseRow(p, `${s}-${i}`))}

                {section.exchanges?.map((ex, i) => (
                  <div
                    key={`${s}-x${i}`}
                    className="votive-row grid grid-cols-[1fr_auto] gap-3 py-3 pl-3 border-b border-[#0f0f0f]"
                    style={{ animationDelay: `${(row++) * ROW_STAGGER_MS}ms` }}
                  >
                    <div className="text-sm italic text-[#bbb]">
                      “{ex.said}”
                      <small className="block not-italic font-bold text-[8.5px] tracking-[0.18em] text-[#555] mt-1 uppercase">{ex.saidEn}</small>
                    </div>
                    <div className="text-xs font-semibold text-white text-right">
                      {ex.reply}
                      <small className="block font-bold text-[8.5px] tracking-[0.18em] text-[#555] mt-1 uppercase">{ex.replyEn}</small>
                    </div>
                  </div>
                ))}
              </section>
            ))}

            {/* Pocket grammar */}
            <div className="mt-8 border border-white/10 border-l-white/40 bg-[#0a0a0a] px-4 py-3.5">
              <div className="flex gap-2.5 items-center font-mono text-[9px] tracking-[0.3em] uppercase text-[#777]">
                <span className="w-1.5 h-1.5 rotate-45 border border-white/60" />
                Pocket grammar
              </div>
              <p className="mt-2.5 text-[12.5px] leading-relaxed text-[#bdbdbd]">{rich(scene.pocket[shown])}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default VotivePanel;
