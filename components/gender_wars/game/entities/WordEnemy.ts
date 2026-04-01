import { WordData, ArticleMode } from '../types';
import { COLORS } from '../constants';

export class WordEnemy {
  data: WordData;
  article: ArticleMode;
  x: number;
  y: number;
  speed: number;
  hit: boolean = false;
  bossHits: number = 0;
  bossMaxHits: number;
  isBoss: boolean;
  phase: 'base' | 'dim' | 'plural' = 'base';
  shieldFlash: number = 0;
  pulseTime: number = 0;
  gracePeriodTimer: number = 0;

  // Boss specific state
  bossState: 'entering' | 'pattern' | 'swooping' | 'returning' = 'entering';
  patternTimer: number = 0;
  startY: number;
  canvasW: number;
  canvasH: number;
  bossWave: number;
  bossType: 'zigzag' | 'teleport' | 'swooper' | 'default' = 'default';
  teleportTimer: number = 0;
  damageTimer: number = 0;

  constructor(wordData: WordData, canvasW: number, canvasH: number, baseSpeed: number, bossWave: number = 1) {
    this.data = wordData;
    this.article = wordData.article;
    this.x = canvasW + 50;
    this.y = 40 + Math.random() * (canvasH - 80);
    this.speed = baseSpeed;
    this.isBoss = wordData.boss;
    this.bossMaxHits = wordData.boss ? 10 : 1;
    this.bossWave = bossWave;
    
    this.startY = this.y;
    this.canvasW = canvasW;
    this.canvasH = canvasH;
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

  update(dt: number, slowActive: boolean, onPhaseChange: (msg: string) => void, playerY: number = 0) {
    const spd = slowActive ? this.speed * 0.3 : this.speed;
    this.pulseTime += dt;
    if (this.shieldFlash > 0) this.shieldFlash -= dt;
    if (this.gracePeriodTimer > 0) this.gracePeriodTimer -= dt;
    if (this.damageTimer > 0) this.damageTimer -= dt;

    if (!this.isBoss) {
      this.x -= spd * dt;
    } else {
      // Boss movement logic
      if (this.bossState === 'entering') {
        this.x -= spd * 2 * dt;
        if (this.x < this.canvasW - 150) {
          this.bossState = 'pattern';
          this.patternTimer = 0;
        }
      } else if (this.bossState === 'pattern') {
        this.patternTimer += dt;
        
        if (this.bossType === 'zigzag') {
          this.y = this.startY + Math.sin(this.patternTimer * 8) * 100;
          this.x = (this.canvasW - 150) + Math.cos(this.patternTimer * 5) * 80;
        } else if (this.bossType === 'teleport') {
          this.teleportTimer += dt;
          this.x -= spd * 0.2 * dt; // slowly drift left
          if (this.teleportTimer > 2) {
            this.teleportTimer = 0;
            this.y = Math.max(50, Math.min(this.canvasH - 50, this.y + (Math.random() - 0.5) * 300));
            this.x = Math.max(this.canvasW / 2, Math.min(this.canvasW - 50, this.x + (Math.random() - 0.5) * 100));
          }
        } else if (this.bossType === 'swooper') {
          this.y += (playerY - this.y) * 1.5 * dt; // aggressively track player Y
          this.x = (this.canvasW - 150) + Math.sin(this.patternTimer * 2) * 50;
          if (this.patternTimer > 3) {
            this.bossState = 'swooping';
            this.patternTimer = 0;
          }
        } else {
          // Default patterns based on wave
          if (this.bossWave === 1) {
            this.y = this.startY + Math.sin(this.patternTimer * 2) * 80;
          } else if (this.bossWave === 2) {
            this.y = this.startY + Math.sin(this.patternTimer * 3) * 120;
            this.x = (this.canvasW - 150) + Math.cos(this.patternTimer * 6) * 50;
          } else {
            this.y = this.startY + Math.sin(this.patternTimer * 5) * 150 * Math.cos(this.patternTimer * 2);
            this.x = (this.canvasW - 150) + Math.sin(this.patternTimer * 4) * 100;
          }
          
          if (this.patternTimer > (this.bossWave === 3 ? 2 : 4)) {
            this.bossState = 'swooping';
            this.patternTimer = 0;
          }
        }
      } else if (this.bossState === 'swooping') {
        this.x -= spd * (this.bossType === 'swooper' ? 8 : 4) * dt; // Fast swoop left
        if (this.x < 50) {
          this.bossState = 'returning';
        }
      } else if (this.bossState === 'returning') {
        this.x += spd * 3 * dt; // Move back right
        this.y += (this.startY - this.y) * 2 * dt; // Return to startY
        if (this.x > this.canvasW - 150) {
          this.bossState = 'pattern';
          this.patternTimer = 0;
        }
      }

      // Phase changes based on health
      const hitFrac = this.bossHits / this.bossMaxHits;
      if (hitFrac > 0.3 && hitFrac < 0.6 && this.phase === 'base') {
        this.phase = 'dim';
        this.article = 'het';
        this.gracePeriodTimer = 2.0; // 2 seconds grace period
        onPhaseChange('DIMINUTIVE!\nAlways HET');
      } else if (hitFrac >= 0.6 && this.phase === 'dim') {
        this.phase = 'plural';
        this.article = 'de';
        this.gracePeriodTimer = 2.0; // 2 seconds grace period
        onPhaseChange('PLURAL!\nAlways DE');
      }
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
    } else {
      if (this.gracePeriodTimer > 0) {
        return 'grace';
      }
      this.speed = Math.min(this.speed * 1.5, baseSpeed * 3);
      this.shieldFlash = 0.2;
      return 'wrong';
    }
  }

  draw(ctx: CanvasRenderingContext2D, hintActive: boolean) {
    const txt = this.currentText;
    const article = this.currentArticle;
    const isBossPhase = this.isBoss;

    if (isBossPhase) {
      const barW = 120;
      const progress = this.bossHits / this.bossMaxHits;
      ctx.fillStyle = COLORS.bg;
      ctx.strokeStyle = COLORS.white;
      ctx.lineWidth = 2;
      ctx.strokeRect(this.x - barW / 2, this.y - 40, barW, 6);
      ctx.fillStyle = COLORS.red;
      ctx.fillRect(this.x - barW / 2, this.y - 40, barW * progress, 6);
    }

    if (hintActive) {
      ctx.font = `12px "Press Start 2P"`;
      ctx.fillStyle = article === 'de' ? COLORS.red : COLORS.white;
      ctx.textAlign = 'center';
      ctx.fillText(article, this.x, this.y - (isBossPhase ? 25 : 20));
    }

    const fontSize = isBossPhase ? 40 : 20;
    ctx.font = `${fontSize}px "Press Start 2P"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (this.shieldFlash > 0) {
      ctx.fillStyle = COLORS.white;
    } else {
      ctx.fillStyle = isBossPhase ? COLORS.red : COLORS.white;
    }
    
    // Retro glitch effect for boss
    if (isBossPhase && Math.random() > 0.9) {
      ctx.fillText(txt, this.x + (Math.random() - 0.5) * 6, this.y + (Math.random() - 0.5) * 6);
    } else {
      ctx.fillText(txt, this.x, this.y);
    }

    if (isBossPhase) {
      ctx.font = `10px "Press Start 2P"`;
      ctx.fillStyle = COLORS.red;
      ctx.fillText('BOSS', this.x, this.y + 35);
    }
  }
}
