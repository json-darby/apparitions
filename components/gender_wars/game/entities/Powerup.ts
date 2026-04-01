import { COLORS } from '../constants';

export type PowerupType = 'slow' | 'hint' | 'life';

export class Powerup {
  x: number;
  y: number;
  type: PowerupType;
  vx: number = -100;
  dead: boolean = false;
  pulse: number = 0;

  constructor(x: number, y: number, type: PowerupType) {
    this.x = x;
    this.y = y;
    this.type = type;
  }

  update(dt: number) {
    this.x += this.vx * dt;
    this.pulse += dt * 5;
    if (this.x < -30) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    const isVisible = Math.sin(this.pulse) > 0;
    if (isVisible) {
      ctx.fillStyle = COLORS.white;
      ctx.strokeStyle = COLORS.red;
      ctx.lineWidth = 2;
      ctx.strokeRect(this.x - 12, this.y - 12, 24, 24);
      
      ctx.font = `12px "Press Start 2P"`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let icon = 'S';
      if (this.type === 'hint') icon = 'H';
      if (this.type === 'life') icon = '+';
      ctx.fillText(icon, this.x, this.y);
    }
    ctx.restore();
  }

  hitsShip(sx: number, sy: number) {
    return Math.abs(this.x - sx) < 30 && Math.abs(this.y - sy) < 30;
  }
}
