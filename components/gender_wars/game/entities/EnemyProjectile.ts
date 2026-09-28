import { COLORS } from '../constants';

/** How far past the edge an orb may travel before it is discarded. */
const OFFSCREEN_MARGIN = 40;
/** Rough radius of the player's ship, for orb collisions. */
const SHIP_RADIUS = 9;

/**
 * A boss orb. Travels in a straight line in any direction; patterns (rings, fans,
 * spirals, walls) are built by firing many of these with different velocities.
 */
export class EnemyProjectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  dead = false;
  private age = 0;

  constructor(x: number, y: number, vx: number, vy: number, radius = 5) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.radius = radius;
  }

  /** An orb fired from (x, y) along `angle` (radians, 0 = right). */
  static atAngle(x: number, y: number, angle: number, speed: number, radius?: number) {
    return new EnemyProjectile(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, radius);
  }

  update(dt: number, canvasW: number, canvasH: number) {
    this.age += dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (
      this.x < -OFFSCREEN_MARGIN || this.x > canvasW + OFFSCREEN_MARGIN ||
      this.y < -OFFSCREEN_MARGIN || this.y > canvasH + OFFSCREEN_MARGIN
    ) {
      this.dead = true;
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    /* A short trail so fast orbs read as moving, not teleporting. */
    const speed = Math.hypot(this.vx, this.vy) || 1;
    ctx.strokeStyle = COLORS.redDim;
    ctx.lineWidth = this.radius;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - (this.vx / speed) * this.radius * 2.2, this.y - (this.vy / speed) * this.radius * 2.2);
    ctx.stroke();

    ctx.fillStyle = COLORS.red;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    /* A flickering white core, so orbs stay visible against the red boss text. */
    ctx.fillStyle = COLORS.white;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * (0.35 + 0.1 * Math.sin(this.age * 20)), 0, Math.PI * 2);
    ctx.fill();
  }

  hitsShip(sx: number, sy: number) {
    return Math.hypot(this.x - sx, this.y - sy) < this.radius + SHIP_RADIUS;
  }
}
