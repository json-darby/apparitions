import { COLORS } from '../constants';

export class FloatingText {
  x: number;
  y: number;
  text: string;
  life: number = 1.5;
  maxLife: number = 1.5;
  vy: number = -20;

  constructor(x: number, y: number, text: string) {
    this.x = x;
    this.y = y;
    this.text = text;
  }

  update(dt: number) {
    this.y += this.vy * dt;
    this.life -= dt;
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.life <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
    ctx.font = `12px "Press Start 2P"`;
    ctx.fillStyle = COLORS.white;
    ctx.textAlign = 'center';
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
}
