import { Ship } from './entities/Ship';
import { WordEnemy } from './entities/WordEnemy';
import { Bullet } from './entities/Bullet';
import { Particle } from './entities/Particle';
import { Powerup, PowerupType } from './entities/Powerup';
import { EnemyProjectile } from './entities/EnemyProjectile';
import { FloatingText } from './entities/FloatingText';
import { WORDS, COLORS } from './constants';
import { GameStats } from './types';

export class GameEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  
  // State
  score: number = 0;
  lives: number = 3;
  level: number = 0;
  wordSpeed: number = 40;
  spawnTimer: number = 0;
  spawnInterval: number = 4.5;
  slowActive: boolean = false;
  slowTimer: number = 0;
  hintActive: boolean = false;
  hintTimer: number = 0;
  streak: number = 0;
  totalFired: number = 0;
  totalHit: number = 0;
  missedWords: { word: string; article: string }[] = [];
  screenShake: number = 0;
  bossProjectileTimer: number = 0;
  wordsDefeatedInLevel: number = 0;
  phase: 'normal' | 'boss_warning' | 'boss_battle' = 'normal';
  bossWarningTimer: number = 0;
  running: boolean = true;
  paused: boolean = false;
  bossWave: number = 1;
  specialWeaponState: 'ready' | 'charging' | 'firing' = 'ready';
  specialWeaponTimer: number = 0;

  // Entities
  ship: Ship;
  words: WordEnemy[] = [];
  bullets: Bullet[] = [];
  particles: Particle[] = [];
  enemyProjectiles: EnemyProjectile[] = [];
  powerups: Powerup[] = [];
  floatingTexts: FloatingText[] = [];

  // Input
  keys = { up: false, down: false, left: false, right: false };
  
  // Callbacks
  onUpdateHUD: (state: any) => void;
  onEndGame: (stats: GameStats) => void;
  onFeedback: (msg: string, color: string) => void;
  onBossWarning: (msg: string) => void;

  lastTime: number = 0;
  animFrame: number = 0;

  isDying: boolean = false;
  deathTimer: number = 0;

  constructor(
    canvas: HTMLCanvasElement,
    onUpdateHUD: (state: any) => void,
    onEndGame: (stats: GameStats) => void,
    onFeedback: (msg: string, color: string) => void,
    onBossWarning: (msg: string) => void
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.ship = new Ship(canvas.height);
    
    this.onUpdateHUD = onUpdateHUD;
    this.onEndGame = onEndGame;
    this.onFeedback = onFeedback;
    this.onBossWarning = onBossWarning;

    this.bindEvents();
  }

  start() {
    this.running = true;
    this.lastTime = performance.now();
    this.animFrame = requestAnimationFrame((ts) => this.loop(ts));
    this.onUpdateHUD(this.getHUDState());
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.animFrame);
    this.unbindEvents();
  }

  bindEvents() {
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  unbindEvents() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }

  handleKeyDown(e: KeyboardEvent) {
    if (!this.running) return;
    if ((e.key === 'Escape' || e.key === 'p' || e.key === 'P') && !e.repeat) {
      this.togglePause();
      return;
    }
    if (this.paused) return;

    if (e.key === 'z' || e.key === 'Z') {
      e.preventDefault();
      this.ship.toggleFacing();
    }

    if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') this.keys.up = true;
    if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') this.keys.down = true;
    if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') this.keys.left = true;
    if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') this.keys.right = true;

    if (e.key === 'Shift') {
      e.preventDefault();
      this.ship.switchTo(this.ship.mode === 'de' ? 'het' : 'de');
      this.onUpdateHUD(this.getHUDState());
    }

    if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      this.activateSpecialWeapon();
    }

    if (e.key === ' ') {
      e.preventDefault();
      if (this.specialWeaponState !== 'charging') {
        this.fireBullet();
      }
    }
  }

  handleKeyUp(e: KeyboardEvent) {
    if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') this.keys.up = false;
    if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') this.keys.down = false;
    if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') this.keys.left = false;
    if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') this.keys.right = false;
  }

  fireBullet() {
    this.ship.fire();
    const bx = this.ship.facing === 'right' ? this.ship.x + 20 : this.ship.x - 20;
    this.bullets.push(new Bullet(bx, this.ship.y, this.ship.mode, this.ship.facing));
    this.totalFired++;
  }

  activateSpecialWeapon() {
    if (this.specialWeaponState === 'ready' && this.lives > 0) {
      this.specialWeaponState = 'charging';
      this.specialWeaponTimer = 1.0; // 1 second charge
      this.onUpdateHUD(this.getHUDState());
    }
  }

  fireDivergentBeam() {
    this.screenShake = 1.5;
    const W = this.canvas.width;
    const H = this.canvas.height;
    
    for (let i = this.words.length - 1; i >= 0; i--) {
      const w = this.words[i];
      if (!w.isBoss) {
        this.score += 50;
        this.spawnParticles(w.x, w.y, COLORS.white);
        this.words.splice(i, 1);
      } else {
        w.bossHits += 50;
        this.spawnParticles(w.x, w.y, COLORS.red);
        if (w.bossHits >= w.bossMaxHits) {
          this.handleBossDeath(w, i, W, H);
        }
      }
    }
  }

  handleBossDeath(w: WordEnemy, index: number, W: number, H: number) {
    if (w.phase === 'plural') {
      for (let k = 0; k < 3; k++) {
        const miniData = { ...w.data, boss: false };
        const mini = new WordEnemy(miniData, W, H, this.wordSpeed * 1.2);
        mini.x = w.x + (Math.random() - 0.5) * 80;
        mini.y = w.y + (Math.random() - 0.5) * 80;
        this.words.push(mini);
      }
      this.onFeedback(`SPLIT!`, COLORS.red);
    }
    
    this.words.splice(index, 1);

    const bossesLeft = this.words.filter(word => word.isBoss).length;
    if (bossesLeft === 0) {
      if (this.level === 3) {
        if (this.bossWave === 1) {
          this.bossWave = 2;
          this.spawnBoss(W, H, 2, 2);
          this.onFeedback('WAVE 2!', COLORS.red);
        } else if (this.bossWave === 2) {
          this.bossWave = 3;
          this.spawnBoss(W, H, 3, 3);
          this.onFeedback('FINAL WAVE!', COLORS.red);
        } else {
          this.stop();
          this.onEndGame({
            score: this.score,
            missed: this.missedWords,
            victory: true
          });
          return;
        }
      } else {
        this.level++;
        const levels = ['A0', 'A1', 'A2', 'B1'];
        this.onFeedback(`${levels[this.level]} UNLOCKED!`, COLORS.white);
        this.wordsDefeatedInLevel = 0;
        this.phase = 'normal';
        this.wordSpeed = 40 + this.level * 20;
        this.spawnInterval = Math.max(1.5, 4.5 - this.level * 0.6);
      }
    }
  }

  loop(ts: number) {
    if (!this.running) return;
    const dt = Math.min((ts - this.lastTime) / 1000, 0.05);
    this.lastTime = ts;

    if (!this.paused) {
      this.update(dt);
    }
    this.render();

    this.animFrame = requestAnimationFrame((ts) => this.loop(ts));
  }

  update(dt: number) {
    const W = this.canvas.width;
    const H = this.canvas.height;

    if (this.isDying) {
      this.deathTimer += dt;
      if (this.deathTimer >= 2.0) {
        this.stop();
        this.onEndGame({
          score: this.score,
          missed: this.missedWords,
          victory: false
        });
        return;
      }
    }

    this.ship.update(dt, this.keys, W, H);

    // Level progression
    if (this.phase === 'normal' && this.wordsDefeatedInLevel >= 20) {
      this.phase = 'boss_warning';
      this.bossWarningTimer = 3;
      this.onBossWarning('BOSS DETECTED');
    }

    if (this.phase === 'boss_warning') {
      this.bossWarningTimer -= dt;
      if (this.bossWarningTimer <= 0) {
        this.phase = 'boss_battle';
        this.bossWave = 1;
        this.spawnBoss(W, H, 1, 1);
      }
    }

    if (this.slowActive) {
      this.slowTimer -= dt;
      if (this.slowTimer <= 0) {
        this.slowActive = false;
        this.onUpdateHUD(this.getHUDState());
      }
    }
    if (this.hintActive) {
      this.hintTimer -= dt;
      if (this.hintTimer <= 0) {
        this.hintActive = false;
        this.onUpdateHUD(this.getHUDState());
      }
    }

    if (this.screenShake > 0) this.screenShake -= dt * 8;

    if (this.specialWeaponState === 'charging') {
      this.specialWeaponTimer -= dt;
      if (this.specialWeaponTimer <= 0) {
        this.specialWeaponState = 'firing';
        this.specialWeaponTimer = 0.5; // 0.5 second firing
        this.loseLife(); // Takes 1 damage
        this.fireDivergentBeam();
        this.onUpdateHUD(this.getHUDState());
      }
    } else if (this.specialWeaponState === 'firing') {
      this.specialWeaponTimer -= dt;
      if (this.specialWeaponTimer <= 0) {
        this.specialWeaponState = 'ready';
        this.onUpdateHUD(this.getHUDState());
      }
    }

    this.spawnTimer += dt;
    const maxWords = 1 + this.level;
    if (this.phase === 'normal' && this.spawnTimer >= this.spawnInterval && this.words.length < maxWords) {
      this.spawnTimer = 0;
      this.spawnWord(W, H);
    }

    // Update words
    for (let i = this.words.length - 1; i >= 0; i--) {
      const w = this.words[i];
      w.update(dt, this.slowActive, this.onBossWarning, this.ship.y);

      if (w.isBoss) {
        this.bossProjectileTimer += dt;
        const fireRate = w.bossState === 'swooping' ? 0.4 : 1.2;
        if (this.bossProjectileTimer > fireRate) {
          this.bossProjectileTimer = 0;
          const projWord = Math.random() > 0.5 ? 'de' : 'het';
          this.enemyProjectiles.push(new EnemyProjectile(w.x, w.y, projWord));
        }
      }

      if (w.x < -100) {
        this.missedWords.push({ word: w.currentText, article: w.currentArticle });
        // this.loseLife(); // Removed losing life on miss
        this.words.splice(i, 1);
        continue;
      }

      // Check collision with ship
      const textWidth = w.currentText.length * 16;
      const dist = Math.abs(this.ship.x - w.x) < textWidth / 2 + 15 && Math.abs(this.ship.y - w.y) < 30;
      
      if (dist) {
        if (w.damageTimer <= 0) {
          this.loseLife();
          this.screenShake = 0.8;
          this.spawnParticles(this.ship.x, this.ship.y, COLORS.red);
          w.damageTimer = 1.0; // 1 second cooldown before next damage
        }
      }
    }

    // Update bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      
      // Auto-aim assist
      let targetWord: WordEnemy | null = null;
      let minDistance = Infinity;
      
      for (const w of this.words) {
        const isAhead = b.facing === 'right' ? w.x > b.x : w.x < b.x;
        if (isAhead) {
          const dx = w.x - b.x;
          const dy = w.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          const currentAngle = Math.atan2(b.vy, b.facing === 'right' ? b.speed : -b.speed);
          const targetAngle = Math.atan2(dy, dx);
          
          let angleDiff = targetAngle - currentAngle;
          while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
          while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
          
          // 10 degrees threshold
          if (Math.abs(angleDiff) < 10 * Math.PI / 180) {
            if (dist < minDistance) {
              minDistance = dist;
              targetWord = w;
            }
          }
        }
      }
      
      if (targetWord) {
        const dx = targetWord.x - b.x;
        const dy = targetWord.y - b.y;
        const targetAngle = Math.atan2(dy, dx);
        
        const currentAngle = Math.atan2(b.vy, b.facing === 'right' ? b.speed : -b.speed);
        let angleDiff = targetAngle - currentAngle;
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
        
        const turnRate = 2; // radians per second
        const newAngle = currentAngle + Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), turnRate * dt);
        
        b.vy = (b.facing === 'right' ? b.speed : -b.speed) * Math.tan(newAngle);
      }

      b.update(dt, W);
      if (b.dead) { this.bullets.splice(i, 1); continue; }

      for (let j = this.words.length - 1; j >= 0; j--) {
        const w = this.words[j];
        // Collision detection (approximate text width)
        const textWidth = w.currentText.length * 16;
        const dist = Math.abs(b.x - w.x) < textWidth / 2 + 15 && Math.abs(b.y - w.y) < 30;
        
        if (dist) {
          b.dead = true;
          const result = w.tryHit(b.article, this.wordSpeed);

          if (result === 'correct') {
            const pts = (100 + this.streak * 10) * (1 + this.level * 0.5);
            this.score += Math.round(pts);
            this.streak++;
            this.totalHit++;
            this.onFeedback(`${w.currentArticle} ${w.currentText} ✓`, COLORS.white);
            this.spawnParticles(w.x, w.y, COLORS.white);
            this.floatingTexts.push(new FloatingText(w.x, w.y, w.data.english));
            
            if (w.isBoss) {
              this.handleBossDeath(w, j, W, H);
            } else {
              this.wordsDefeatedInLevel++;
              this.words.splice(j, 1);
            }
            
            if (Math.random() < 0.15) this.spawnPowerup(w.x, w.y);
          } else if (result === 'boss-hit') {
            this.totalHit++;
            this.score += 20;
            this.spawnParticles(w.x, w.y, COLORS.red);
          } else if (result === 'grace') {
            this.spawnParticles(w.x, w.y, COLORS.white);
            // Ignore penalty during grace period
          } else {
            this.streak = 0;
            this.screenShake = 0.5;
            this.onFeedback(`✗ ${w.currentArticle} ${w.currentText}`, COLORS.redDim);
          }

          this.onUpdateHUD(this.getHUDState());
          break;
        }
      }
    }

    // Update enemy projectiles
    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      const ep = this.enemyProjectiles[i];
      ep.update(dt);
      if (ep.dead) { this.enemyProjectiles.splice(i, 1); continue; }
      if (ep.hitsShip(this.ship.x, this.ship.y)) {
        ep.dead = true;
        this.loseLife();
        this.screenShake = 0.8;
        this.spawnParticles(this.ship.x, this.ship.y, COLORS.red);
      }
    }

    // Update powerups
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const pu = this.powerups[i];
      pu.update(dt);
      if (pu.dead) { this.powerups.splice(i, 1); continue; }
      if (pu.hitsShip(this.ship.x, this.ship.y)) {
        pu.dead = true;
        this.activatePowerup(pu.type);
      }
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update(dt);
      if (this.particles[i].life <= 0) this.particles.splice(i, 1);
    }

    // Update floating texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      this.floatingTexts[i].update(dt);
      if (this.floatingTexts[i].life <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  render() {
    const W = this.canvas.width;
    const H = this.canvas.height;
    
    this.ctx.fillStyle = COLORS.bg;
    this.ctx.fillRect(0, 0, W, H);

    this.ctx.save();
    if (this.screenShake > 0) {
      const s = this.screenShake * 10;
      this.ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }

    // Draw starfield (simple)
    this.ctx.fillStyle = COLORS.white;
    for(let i=0; i<50; i++) {
      const sx = (Date.now() / 20 + i * 100) % W;
      const sy = (i * 53) % H;
      this.ctx.fillRect(W - sx, sy, 1, 1);
    }

    this.powerups.forEach(p => p.draw(this.ctx));
    this.words.forEach(w => w.draw(this.ctx, this.hintActive));
    this.enemyProjectiles.forEach(ep => ep.draw(this.ctx));
    this.bullets.forEach(b => b.draw(this.ctx));
    this.particles.forEach(p => p.draw(this.ctx));
    this.floatingTexts.forEach(ft => ft.draw(this.ctx));
    
    this.ctx.save();
    if (this.specialWeaponState === 'charging') {
      this.ctx.translate((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10);
    }
    this.ship.draw(this.ctx);
    this.ctx.restore();

    if (this.specialWeaponState === 'firing') {
      const progress = 1 - (this.specialWeaponTimer / 0.5);
      const expandWidth = 20 + (W * progress * 3); // Expands to fill screen
      const startWidth = 20;
      
      this.ctx.fillStyle = `rgba(0, 255, 255, ${1 - progress})`;
      this.ctx.beginPath();
      
      if (this.ship.facing === 'right') {
        const startX = this.ship.x + 20;
        this.ctx.moveTo(startX, this.ship.y - startWidth / 2);
        this.ctx.lineTo(startX, this.ship.y + startWidth / 2);
        this.ctx.lineTo(startX + W, this.ship.y + expandWidth / 2);
        this.ctx.lineTo(startX + W, this.ship.y - expandWidth / 2);
      } else {
        const startX = this.ship.x - 20;
        this.ctx.moveTo(startX, this.ship.y - startWidth / 2);
        this.ctx.lineTo(startX, this.ship.y + startWidth / 2);
        this.ctx.lineTo(startX - W, this.ship.y + expandWidth / 2);
        this.ctx.lineTo(startX - W, this.ship.y - expandWidth / 2);
      }
      
      this.ctx.closePath();
      this.ctx.fill();
    }

    this.ctx.restore();

    if (this.isDying) {
      const alpha = Math.min(1, this.deathTimer / 2.0);
      this.ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
      this.ctx.fillRect(0, 0, W, H);
    }
  }

  spawnWord(W: number, H: number) {
    const pool = WORDS.filter(w => w.level === this.level && !w.boss);
    if (pool.length === 0) return;
    const w = pool[Math.floor(Math.random() * pool.length)];
    this.words.push(new WordEnemy(w, W, H, this.wordSpeed));
  }

  spawnBoss(W: number, H: number, count: number = 1, wave: number = 1) {
    const pool = WORDS.filter(w => w.level === this.level && w.boss);
    if (pool.length === 0) return;
    
    const types: ('zigzag' | 'teleport' | 'swooper' | 'default')[] = ['zigzag', 'teleport', 'swooper'];
    
    for (let i = 0; i < count; i++) {
      const w = pool[Math.floor(Math.random() * pool.length)];
      const boss = new WordEnemy(w, W, H, this.wordSpeed, wave);
      boss.y = (H / (count + 1)) * (i + 1);
      boss.startY = boss.y;
      if (this.level === 3) {
        boss.bossType = types[i % types.length];
      }
      this.words.push(boss);
    }
  }

  spawnParticles(x: number, y: number, color: string) {
    for (let i = 0; i < 15; i++) {
      this.particles.push(new Particle(x, y, color));
    }
  }

  spawnPowerup(x: number, y: number) {
    const r = Math.random();
    let type: PowerupType = 'slow';
    if (r > 0.4) type = 'hint';
    if (r > 0.8) type = 'life';
    this.powerups.push(new Powerup(x, y, type));
  }

  activatePowerup(type: PowerupType) {
    if (type === 'slow') {
      this.slowActive = true;
      this.slowTimer = 5;
    } else if (type === 'hint') {
      this.hintActive = true;
      this.hintTimer = 5;
    } else if (type === 'life') {
      if (this.lives < 5) this.lives++;
      this.onFeedback('+1 LIFE', COLORS.white);
    }
    this.onUpdateHUD(this.getHUDState());
  }

  loseLife() {
    if (this.isDying) return;
    this.lives = Math.max(0, this.lives - 1);
    this.streak = 0;
    this.onUpdateHUD(this.getHUDState());
    if (this.lives <= 0) {
      this.isDying = true;
      this.deathTimer = 0;
    }
  }

  getHUDState() {
    return {
      score: this.score,
      lives: this.lives,
      level: this.level,
      mode: this.ship.mode,
      slowActive: this.slowActive,
      hintActive: this.hintActive,
      paused: this.paused,
      specialWeaponState: this.specialWeaponState
    };
  }

  togglePause() {
    this.paused = !this.paused;
    this.onUpdateHUD(this.getHUDState());
  }
}
