import { WordData, ArticleMode } from '../types';
import { COLORS } from '../constants';
import { BossBrain, BossContext } from '../boss/BossBrain';
import { BossProfile } from '../boss/profiles';

type Phase = 'base' | 'dim' | 'plural';
const PHASES: Phase[] = ['base', 'dim', 'plural'];

const WORD_FONT_PX = 20;
const BOSS_FONT_PX = 40;
/** Long boss words shrink so they never cover more than this share of the screen. */
const BOSS_MAX_WIDTH_SHARE = 0.42;
/** Seconds of forgiveness for the old article right after a boss changes form. */
const PHASE_GRACE_SECONDS = 2;

export class WordEnemy {
  data: WordData;
  x: number;
  y: number;
  speed: number;
  hit = false;
  bossHits = 0;
  bossMaxHits = 1;
  isBoss: boolean;
  phase: Phase = 'base';
  /** Set for one frame when a boss changes form, so the engine can react. */
  phaseChanged = false;
  shieldFlash = 0;
  gracePeriodTimer = 0;
  damageTimer = 0;
  brain: BossBrain | null = null;
  private canvasW: number;

  constructor(wordData: WordData, canvasW: number, canvasH: number, baseSpeed: number) {
    this.data = wordData;
    this.x = canvasW + 50;
    this.y = 40 + Math.random() * (canvasH - 80);
    this.speed = baseSpeed;
    /* Only makeBoss() turns a word into a boss, so it always has a brain. */
    this.isBoss = false;
    this.canvasW = canvasW;
  }

  /** Turns this word into a boss driven by the given stage profile. */
  makeBoss(profile: BossProfile, wave: number) {
    this.isBoss = true;
    this.bossMaxHits = profile.hp;
    this.brain = new BossBrain(this, profile, wave);
  }

  get currentArticle(): ArticleMode {
    if (this.phase === 'dim') return 'het';
    if (this.phase === 'plural') return 'de';
    return this.data.article;
  }

  get currentText(): string {
    if (this.phase === 'dim') return this.data.dim;
    if (this.phase === 'plural') return this.data.plural;
    return this.data.word;
  }

  /** "Press Start 2P" is monospaced at 1em per glyph, so width is length x size. */
  get fontSize(): number {
    if (!this.isBoss) return WORD_FONT_PX;
    return Math.min(BOSS_FONT_PX, Math.floor((this.canvasW * BOSS_MAX_WIDTH_SHARE) / this.currentText.length));
  }

  /** Half the drawn width of the word, for collisions. */
  get hitHalfWidth(): number {
    return (this.currentText.length * this.fontSize) / 2 + 6;
  }

  get hitHalfHeight(): number {
    return this.fontSize * 0.6 + 8;
  }

  /**
   * @param boss  Present for bosses only: the world the brain acts in.
   */
  update(dt: number, slowActive: boolean, onPhaseChange: (msg: string) => void, boss?: BossContext) {
    this.phaseChanged = false;
    if (this.shieldFlash > 0) this.shieldFlash -= dt;
    if (this.gracePeriodTimer > 0) this.gracePeriodTimer -= dt;
    if (this.damageTimer > 0) this.damageTimer -= dt;

    if (!this.brain || !boss) {
      this.x -= (slowActive ? this.speed * 0.3 : this.speed) * dt;
      return;
    }

    this.brain.update(boss);

    /* Health phases: a third of the way down it shrinks (diminutive, always het),
       two thirds down it multiplies (plural, always de). */
    const hitFrac = this.bossHits / this.bossMaxHits;
    const next: Phase = hitFrac >= 0.6 ? 'plural' : hitFrac > 0.3 ? 'dim' : 'base';
    if (PHASES.indexOf(next) > PHASES.indexOf(this.phase)) {
      this.phase = next;
      this.phaseChanged = true;
      this.gracePeriodTimer = PHASE_GRACE_SECONDS;
      this.brain.setPhase(PHASES.indexOf(next), boss);
      onPhaseChange(next === 'dim' ? 'DIMINUTIVE!\nAlways HET' : 'PLURAL!\nAlways DE');
    }
  }

  tryHit(firedArticle: ArticleMode, baseSpeed: number): 'correct' | 'boss-hit' | 'wrong' | 'grace' {
    if (firedArticle === this.currentArticle) {
      this.bossHits++;
      if (!this.isBoss || this.bossHits >= this.bossMaxHits) {
        this.hit = true;
        return 'correct';
      }
      this.shieldFlash = 0.15;
      return 'boss-hit';
    }
    if (this.gracePeriodTimer > 0) return 'grace';

    this.shieldFlash = 0.2;
    if (this.brain) {
      this.brain.provoke();
    } else {
      this.speed = Math.min(this.speed * 1.5, baseSpeed * 3);
    }
    return 'wrong';
  }

  draw(ctx: CanvasRenderingContext2D, hintActive: boolean) {
    const txt = this.currentText;
    const article = this.currentArticle;
    const boss = this.brain;
    const size = this.fontSize;

    ctx.save();
    if (boss) ctx.globalAlpha = boss.opacity;

    if (boss) {
      const barW = Math.max(120, this.hitHalfWidth);
      const progress = this.bossHits / this.bossMaxHits;
      ctx.strokeStyle = COLORS.white;
      ctx.lineWidth = 2;
      ctx.strokeRect(this.x - barW / 2, this.y - size - 4, barW, 6);
      ctx.fillStyle = COLORS.red;
      ctx.fillRect(this.x - barW / 2, this.y - size - 4, barW * progress, 6);
    }

    if (hintActive) {
      ctx.font = `12px "Press Start 2P"`;
      ctx.fillStyle = article === 'de' ? COLORS.red : COLORS.white;
      ctx.textAlign = 'center';
      ctx.fillText(article, this.x, this.y - (boss ? size - 12 : 20));
    }

    ctx.font = `${size}px "Press Start 2P"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const white = this.shieldFlash > 0 || (boss?.flashing ?? false);
    ctx.fillStyle = white ? COLORS.white : boss ? COLORS.red : COLORS.white;

    /* Retro glitch jitter on bosses. */
    if (boss && Math.random() > 0.9) {
      ctx.fillText(txt, this.x + (Math.random() - 0.5) * 6, this.y + (Math.random() - 0.5) * 6);
    } else {
      ctx.fillText(txt, this.x, this.y);
    }

    if (boss) {
      ctx.font = `10px "Press Start 2P"`;
      ctx.fillStyle = boss.exposed ? COLORS.white : COLORS.red;
      ctx.fillText(boss.exposed ? 'EXPOSED' : 'BOSS', this.x, this.y + size * 0.6 + 14);
    }
    ctx.restore();
  }
}
