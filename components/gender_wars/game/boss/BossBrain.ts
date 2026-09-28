import { EnemyProjectile } from '../entities/EnemyProjectile';
import { COLORS } from '../constants';
import {
  AttackName,
  BossProfile,
  PHASE_SCALING,
  PROVOKE_IDLE_CUT,
  WAVE_TELEGRAPH_SCALE,
} from './profiles';

/** What a boss needs from the world each frame. */
export interface BossContext {
  /** Already scaled for slow-motion. */
  dt: number;
  canvasW: number;
  canvasH: number;
  playerX: number;
  playerY: number;
  emit: (orb: EnemyProjectile) => void;
  /** Only one boss may attack at a time; the rest sway and wait their turn. */
  requestAttackSlot: (brain: BossBrain) => boolean;
  releaseAttackSlot: (brain: BossBrain) => void;
}

type State = 'entering' | 'idle' | 'telegraph' | 'attack' | 'recover';

/** Anything with a position the brain can move: the boss's word. */
interface Body { x: number; y: number }

const TAU = Math.PI * 2;
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/**
 * The behaviour of one boss, as a loop the player can learn:
 *
 *   idle (sway, the odd pot-shot) -> telegraph (the tell) -> attack -> recover (exposed)
 *
 * Difficulty comes entirely from the BossProfile for the stage, scaled by the
 * boss's current health phase, so a stage-4 boss is the stage-1 boss with more
 * moves, shorter tells and smaller openings, not a different game.
 */
export class BossBrain {
  state: State = 'entering';
  private timer = 0;
  private attack: AttackName | null = null;
  private lastAttack: AttackName | null = null;
  private phase = 0;
  private swayTime = Math.random() * TAU;
  private anchorY: number;
  private potShotTimer = 0;

  /* Per-attack working state. */
  private lockY = 0;
  private gapAngle = 0;
  private gapY = 0;
  private shotsFired = 0;
  private emitTimer = 0;
  private spiralAngle = 0;
  private spiralDir = 1;
  private flankSide = 0;
  private chained = false;

  constructor(
    private readonly body: Body,
    private readonly profile: BossProfile,
    private readonly wave: number,
  ) {
    this.anchorY = body.y;
  }

  /* ---------------- Read by the renderer ---------------- */

  /** True while it is exposed after an attack: the moment to strike. */
  get exposed() { return this.state === 'recover'; }

  /** Blinks white while winding up, so the tell reads even out of the corner of your eye. */
  get flashing() { return this.state === 'telegraph' && Math.floor(this.timer * 14) % 2 === 0; }

  /** Fades out while it slips behind you, and back in once there. */
  get opacity() {
    if (this.attack !== 'flank') return 1;
    if (this.state === 'telegraph') return clamp(1 - this.progress * 1.4, 0.08, 1);
    if (this.state === 'attack' && this.timer < 0.25) return clamp(this.timer / 0.25, 0.08, 1);
    return 1;
  }

  /* ---------------- Events from the game ---------------- */

  /** Health phase changed (base -> diminutive -> plural): drop what it was doing and come back angrier. */
  setPhase(phase: number, ctx: BossContext) {
    this.phase = clamp(phase, 0, PHASE_SCALING.length - 1);
    ctx.releaseAttackSlot(this);
    this.attack = null;
    this.goIdle(0.9);
  }

  /** A wrong-article hit provokes it into attacking sooner. */
  provoke() {
    if (this.state === 'idle') this.timer = Math.min(this.timer, this.idleDuration * (1 - PROVOKE_IDLE_CUT));
  }

  /** Called when the boss dies so its turn passes to the next one. */
  release(ctx: BossContext) { ctx.releaseAttackSlot(this); }

  /* ---------------- Tunables, scaled by phase and wave ---------------- */

  private get speed() { return this.profile.speed * PHASE_SCALING[this.phase].speed; }
  private get telegraphDuration() {
    const chainCut = this.chained ? 0.7 : 1;
    return this.profile.telegraph * PHASE_SCALING[this.phase].telegraph * (WAVE_TELEGRAPH_SCALE[this.wave - 1] ?? 1) * chainCut;
  }
  private get idleDuration() { return this.profile.idle * PHASE_SCALING[this.phase].idle; }
  private get orbSpeed() { return this.profile.orbSpeed * this.speed; }
  private get progress() { return this.duration > 0 ? clamp(this.timer / this.duration, 0, 1) : 1; }
  private duration = 0;

  private homeX(W: number) { return W - Math.max(90, W * 0.14); }

  /* ---------------- The loop ---------------- */

  update(ctx: BossContext) {
    const { dt, canvasW: W, canvasH: H } = ctx;
    this.timer += dt;
    this.swayTime += dt * 1.6 * this.speed;

    switch (this.state) {
      case 'entering':
        this.body.x -= 260 * dt;
        if (this.body.x <= this.homeX(W)) { this.body.x = this.homeX(W); this.goIdle(this.idleDuration); }
        break;

      case 'idle':
        this.sway(ctx);
        this.potShot(ctx);
        if (this.timer >= this.duration && ctx.requestAttackSlot(this)) this.beginTelegraph(ctx);
        break;

      case 'telegraph':
        this.windUp(ctx);
        if (this.timer >= this.duration) this.beginAttack(ctx);
        break;

      case 'attack':
        if (this.runAttack(ctx)) this.finishAttack(ctx);
        break;

      case 'recover':
        /* Exposed: drifts gently, fires nothing. */
        this.body.y += Math.sin(this.swayTime * 2) * 12 * dt;
        if (this.timer >= this.duration) this.goIdle(this.idleDuration * rand(0.8, 1.2));
        break;
    }

    this.body.y = clamp(this.body.y, 40, H - 40);
  }

  private setState(state: State, duration: number) {
    this.state = state;
    this.timer = 0;
    this.duration = duration;
  }

  private goIdle(duration: number) { this.setState('idle', duration); }

  /** Space Impact-style bob around its post, returning home if an attack left it elsewhere. */
  private sway(ctx: BossContext) {
    const { dt, canvasW: W, canvasH: H } = ctx;
    this.body.x += (this.homeX(W) - this.body.x) * Math.min(1, dt * 2.5);
    const targetY = clamp(this.anchorY + Math.sin(this.swayTime) * H * 0.2, 50, H - 50);
    this.body.y += (targetY - this.body.y) * Math.min(1, dt * 3);
  }

  /** The odd single aimed shot while idling, so there is never total safety. */
  private potShot(ctx: BossContext) {
    this.potShotTimer += ctx.dt;
    const every = 2.4 / this.speed;
    if (this.potShotTimer < every) return;
    this.potShotTimer = 0;
    const angle = Math.atan2(ctx.playerY - this.body.y, ctx.playerX - this.body.x);
    ctx.emit(EnemyProjectile.atAngle(this.body.x, this.body.y, angle, this.orbSpeed * 0.9, 4));
  }

  private pickAttack(): AttackName {
    const options = this.profile.attacks.filter(a => a !== this.lastAttack);
    return options[Math.floor(Math.random() * options.length)];
  }

  private beginTelegraph(ctx: BossContext) {
    const { canvasH: H, playerY } = ctx;
    this.attack = this.pickAttack();
    this.shotsFired = 0;
    this.emitTimer = 0;

    switch (this.attack) {
      case 'charge':
        this.lockY = clamp(playerY, 50, H - 50);
        break;
      case 'burst':
        /* The gap is offset from you, never on you: standing still is not a dodge. */
        this.gapAngle = rand(0.45, 0.85) * (Math.random() < 0.5 ? -1 : 1);
        break;
      case 'wall':
        this.gapY = clamp(playerY + rand(-H * 0.35, H * 0.35), 70, H - 70);
        break;
      case 'spiral':
        this.spiralAngle = Math.random() * TAU;
        this.spiralDir = Math.random() < 0.5 ? -1 : 1;
        break;
      case 'flank':
        /* Reappear above or below you, whichever has room, so it never lands on top of you. */
        this.flankSide = playerY > H / 2 ? -1 : 1;
        this.lockY = clamp(playerY + this.flankSide * H * 0.3, 50, H - 50);
        break;
    }
    this.setState('telegraph', this.telegraphDuration);
  }

  /** Movement during the tell: lines up for a charge, rears back, etc. */
  private windUp(ctx: BossContext) {
    const { dt, canvasW: W } = ctx;
    if (this.attack === 'charge') {
      this.body.y += (this.lockY - this.body.y) * Math.min(1, dt * 8);
      this.body.x += (this.homeX(W) + 30 - this.body.x) * Math.min(1, dt * 4); // rear back
    } else if (this.attack !== 'flank') {
      this.sway(ctx);
    }
  }

  private beginAttack(ctx: BossContext) {
    if (this.attack === 'flank') {
      this.body.x = Math.max(60, ctx.canvasW * 0.07);
      this.body.y = this.lockY;
    }
    this.setState('attack', 0);
  }

  /** Runs one frame of the current attack. Returns true when it is finished. */
  private runAttack(ctx: BossContext): boolean {
    const { dt, canvasW: W, canvasH: H, playerX, playerY, emit } = ctx;
    const aimAtPlayer = () => Math.atan2(playerY - this.body.y, playerX - this.body.x);
    this.emitTimer -= dt;

    switch (this.attack) {
      case 'burst': {
        if (this.emitTimer <= 0 && this.shotsFired < this.profile.rings) {
          const n = this.profile.ringOrbs;
          const gapCentre = aimAtPlayer() + this.gapAngle * (this.shotsFired % 2 === 0 ? 1 : -1);
          const gapHalf = (TAU / n) * 1.6;
          const offset = this.shotsFired * (Math.PI / n);
          for (let i = 0; i < n; i++) {
            const angle = offset + (i / n) * TAU;
            const fromGap = Math.atan2(Math.sin(angle - gapCentre), Math.cos(angle - gapCentre));
            if (Math.abs(fromGap) < gapHalf) continue;
            emit(EnemyProjectile.atAngle(this.body.x, this.body.y, angle, this.orbSpeed * 0.85, 6));
          }
          this.shotsFired++;
          this.emitTimer = 0.45;
        }
        return this.shotsFired >= this.profile.rings && this.emitTimer <= 0;
      }

      case 'fan': {
        const volleys = this.phase >= 1 ? 3 : 2;
        if (this.emitTimer <= 0 && this.shotsFired < volleys) {
          const n = this.profile.fanOrbs;
          const base = aimAtPlayer();
          const spread = 0.2;
          for (let i = 0; i < n; i++) {
            const angle = base + (i - (n - 1) / 2) * spread;
            emit(EnemyProjectile.atAngle(this.body.x, this.body.y, angle, this.orbSpeed * 1.15, 5));
          }
          this.shotsFired++;
          this.emitTimer = 0.38;
        }
        return this.shotsFired >= volleys && this.emitTimer <= 0;
      }

      case 'wall': {
        const walls = this.profile.rings >= 3 ? 2 : 1;
        if (this.emitTimer <= 0 && this.shotsFired < walls) {
          const spacing = 34;
          const gapHalf = 52;
          const gapY = this.shotsFired === 0 ? this.gapY : clamp(H - this.gapY, 70, H - 70);
          for (let y = 20; y < H - 10; y += spacing) {
            if (Math.abs(y - gapY) < gapHalf) continue;
            emit(new EnemyProjectile(W + 10, y, -this.orbSpeed * 0.8, 0, 6));
          }
          this.shotsFired++;
          this.emitTimer = 1.1;
        }
        return this.shotsFired >= walls && this.emitTimer <= 0;
      }

      case 'charge': {
        this.body.x -= W * 1.5 * this.speed * dt;
        return this.body.x <= Math.max(40, W * 0.05);
      }

      case 'spiral': {
        const length = 2.2;
        this.spiralAngle += this.spiralDir * 2.3 * this.speed * dt;
        if (this.emitTimer <= 0) {
          const arms = this.profile.spiralArms;
          for (let i = 0; i < arms; i++) {
            emit(EnemyProjectile.atAngle(this.body.x, this.body.y, this.spiralAngle + (i / arms) * TAU, this.orbSpeed * 0.75, 5));
          }
          this.emitTimer = 0.11;
        }
        return this.timer >= length;
      }

      case 'flank': {
        /* Fires fans forwards at you from behind for a moment. */
        if (this.timer > 0.3 && this.emitTimer <= 0 && this.shotsFired < 3) {
          const base = aimAtPlayer();
          for (let i = -1; i <= 1; i++) emit(EnemyProjectile.atAngle(this.body.x, this.body.y, base + i * 0.22, this.orbSpeed, 5));
          this.shotsFired++;
          this.emitTimer = 0.7;
        }
        return this.shotsFired >= 3 && this.emitTimer <= 0;
      }
    }
    return true;
  }

  private finishAttack(ctx: BossContext) {
    this.lastAttack = this.attack;
    this.anchorY = this.body.y;

    /* Later stages sometimes chain straight into another move with no opening. */
    if (!this.chained && this.phase >= 1 && Math.random() < this.profile.chainChance) {
      this.chained = true;
      this.beginTelegraph(ctx);
      return;
    }
    this.chained = false;
    ctx.releaseAttackSlot(this);
    this.setState('recover', this.profile.recover);
  }

  /* ---------------- Tells ---------------- */

  /** Draws the warning for the move being wound up. Called beneath the boss word. */
  drawTell(ctx: CanvasRenderingContext2D, W: number, H: number, playerX: number, playerY: number, laneHalf = 24) {
    if (this.state !== 'telegraph' || !this.attack) return;
    const p = this.progress;
    const pulse = 0.35 + 0.35 * Math.sin(this.timer * 30);

    ctx.save();
    ctx.strokeStyle = COLORS.red;
    ctx.fillStyle = COLORS.red;
    ctx.lineWidth = 2;

    switch (this.attack) {
      case 'charge': {
        /* The lane it will ram down, exactly as tall as it is: a faint band that
           grows from the boss to the far edge as the charge winds up. */
        const reach = this.body.x * p;
        const left = this.body.x - reach;
        ctx.globalAlpha = 0.07 + p * 0.13;
        ctx.fillRect(left, this.lockY - laneHalf, reach, laneHalf * 2);
        ctx.globalAlpha = 0.35 + p * 0.45;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(left, this.lockY - laneHalf); ctx.lineTo(this.body.x, this.lockY - laneHalf);
        ctx.moveTo(left, this.lockY + laneHalf); ctx.lineTo(this.body.x, this.lockY + laneHalf);
        ctx.stroke();
        /* A bright leading edge, so the growth reads as motion. */
        ctx.globalAlpha = 0.9;
        ctx.fillRect(left - 2, this.lockY - laneHalf, 3, laneHalf * 2);
        break;
      }

      case 'burst':
        ctx.globalAlpha = 0.3 + p * 0.5;
        ctx.beginPath(); ctx.arc(this.body.x, this.body.y, 140 * (1 - p) + 30, 0, TAU); ctx.stroke();
        break;

      case 'fan': {
        /* Short sight-lines that lengthen toward you. */
        ctx.lineWidth = 1;
        const n = this.profile.fanOrbs;
        const aim = Math.atan2(playerY - this.body.y, playerX - this.body.x);
        for (let i = 0; i < n; i++) {
          const a = aim + (i - (n - 1) / 2) * 0.2;
          const len = 40 + 110 * p;
          ctx.globalAlpha = 0.25 + p * 0.5;
          ctx.beginPath(); ctx.moveTo(this.body.x, this.body.y); ctx.lineTo(this.body.x + Math.cos(a) * len, this.body.y + Math.sin(a) * len); ctx.stroke();
        }
        break;
      }

      case 'wall':
        /* A solid bar down the right edge with the gap cut out: fly for the gap. */
        ctx.globalAlpha = 0.3 + p * 0.5;
        ctx.fillRect(W - 5, 0, 3, this.gapY - 52);
        ctx.fillRect(W - 5, this.gapY + 52, 3, H - (this.gapY + 52));
        break;

      case 'spiral':
        ctx.globalAlpha = 0.25 + p * 0.5;
        for (let i = 0; i < this.profile.spiralArms; i++) {
          const a = this.spiralAngle + this.timer * 6 * this.spiralDir + (i / this.profile.spiralArms) * TAU;
          ctx.beginPath(); ctx.moveTo(this.body.x, this.body.y); ctx.lineTo(this.body.x + Math.cos(a) * 70, this.body.y + Math.sin(a) * 70); ctx.stroke();
        }
        break;

      case 'flank': {
        /* Chevrons at the left edge: "it's coming from behind". */
        ctx.globalAlpha = pulse + 0.2;
        ctx.font = `16px "Press Start 2P"`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('>>', 10, this.lockY);
        break;
      }
    }
    ctx.restore();
  }
}
