import { ArticleMode } from '../types';
import { COLORS } from '../constants';

export class Ship {
  x: number;
  y: number;
  mode: ArticleMode = 'de';
  speed: number = 300;
  fireAnim: number = 0;
  facing: 'right' | 'left' = 'right';

  constructor(canvasH: number) {
    this.x = 50;
    this.y = canvasH / 2;
  }

  update(dt: number, keys: { up: boolean; down: boolean; left: boolean; right: boolean }, canvasW: number, canvasH: number) {
    if (keys.up) this.y -= this.speed * dt;
    if (keys.down) this.y += this.speed * dt;
    if (keys.left) this.x -= this.speed * dt;
    if (keys.right) this.x += this.speed * dt;

    // Constrain
    if (this.x < 20) this.x = 20;
    if (this.x > canvasW / 2) this.x = canvasW / 2;
    if (this.y < 20) this.y = 20;
    if (this.y > canvasH - 20) this.y = canvasH - 20;

    if (this.fireAnim > 0) this.fireAnim -= dt * 5;
  }

  draw(ctx: CanvasRenderingContext2D) {
    const isDE = this.mode === 'de';
    const color = isDE ? COLORS.red : COLORS.white;

    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.facing === 'left') {
      ctx.scale(-1, 1);
    }

    ctx.fillStyle = color;
    
    // Draw retro ship (side-scrolling)
    //   ██
    // ██████
    //   ██
    const size = 4;
    
    // Core
    ctx.fillRect(-4 * size, -1 * size, 8 * size, 2 * size);
    // Wings
    ctx.fillRect(-2 * size, -3 * size, 3 * size, 2 * size);
    ctx.fillRect(-2 * size, 1 * size, 3 * size, 2 * size);
    // Cockpit
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(1 * size, -1 * size, 2 * size, 1 * size);
    
    // Gun barrel
    ctx.fillStyle = color;
    ctx.fillRect(4 * size, -0.5 * size, 3 * size, 1 * size);

    // Recoil effect
    if (this.fireAnim > 0) {
      ctx.fillStyle = COLORS.white;
      ctx.fillRect(7 * size, -1 * size, 2 * size, 2 * size);
    }

    ctx.restore();

    // Label
    ctx.font = `10px "Press Start 2P"`;
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.fillText(isDE ? 'DE' : 'HET', this.x, this.y + 20);
  }

  switchTo(mode: ArticleMode) {
    this.mode = mode;
  }

  toggleFacing() {
    this.facing = this.facing === 'right' ? 'left' : 'right';
  }

  fire() {
    this.fireAnim = 1;
  }
}
