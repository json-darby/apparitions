import { WordData } from './types';
import { WORDS } from './constants';

/** Every block of this many words is exactly half de, half het. */
const BLOCK_SIZE = 4;

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Deals a level's words like a shuffled deck instead of rolling a die each time.
 *
 * Pure random picks average 50/50 but give no guarantee: five de-words in a row, or
 * the same word twice running, were both possible. Here the order is still
 * unpredictable, but every block of four holds two de and two het, and no word
 * returns until the whole list has been dealt.
 */
export class WordDeck {
  private queue: WordData[] = [];

  constructor(private readonly pool: WordData[]) {}

  /** The regular (non-boss) words of one stage. */
  static forLevel(level: number) {
    return new WordDeck(WORDS.filter(w => w.level === level && !w.boss));
  }

  next(): WordData | null {
    if (this.pool.length === 0) return null;
    if (this.queue.length === 0) this.queue = this.deal();
    return this.queue.shift()!;
  }

  private deal(): WordData[] {
    const de = shuffle(this.pool.filter(w => w.article === 'de'));
    const het = shuffle(this.pool.filter(w => w.article === 'het'));
    const half = BLOCK_SIZE / 2;
    const dealt: WordData[] = [];

    while (de.length || het.length) {
      dealt.push(...shuffle([...de.splice(0, half), ...het.splice(0, half)]));
    }
    return dealt;
  }
}
