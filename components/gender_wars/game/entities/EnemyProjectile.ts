import { COLORS } from '../constants';

export class EnemyProjectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dead: boolean = false;
  word: string;

  constructor(x: number, y: number, word: string = 'de') {
    this.x = x;
    this.y = y;
    this.word = word;
    this.vx = -150 - Math.random() * 100;
    this.vy = (Math.random() - 0.5) * 50;
  }

  update(dt: number) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.x < -50) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = COLORS.red;
    ctx.font = `10px "Press Start 2P"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.word, this.x, this.y);
  }

  hitsShip(sx: number, sy: number) {
    return Math.abs(this.x - sx) < 20 && Math.abs(this.y - sy) < 20;
  }
}
