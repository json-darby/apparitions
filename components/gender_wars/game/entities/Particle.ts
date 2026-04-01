import { COLORS } from '../constants';

export class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number = 1;
  decay: number;
  size: number;
  color: string;

  constructor(x: number, y: number, color: string) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 300;
    this.vy = (Math.random() - 0.5) * 300;
    this.decay = 1.5 + Math.random() * 2;
    this.size = 2 + Math.random() * 4;
    this.color = color;
  }

  update(dt: number) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= this.decay * dt;
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.life <= 0) return;
    ctx.fillStyle = this.color;
    // Pixelated particles
    const s = Math.max(1, Math.floor(this.size * this.life));
    ctx.fillRect(Math.floor(this.x), Math.floor(this.y), s, s);
  }
}
