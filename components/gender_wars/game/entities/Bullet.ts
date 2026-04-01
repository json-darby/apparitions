import { ArticleMode } from '../types';
import { COLORS } from '../constants';

export class Bullet {
  x: number;
  y: number;
  vy: number = 0;
  article: ArticleMode;
  speed: number = 800;
  dead: boolean = false;
  facing: 'right' | 'left';

  constructor(x: number, y: number, article: ArticleMode, facing: 'right' | 'left' = 'right') {
    this.x = x;
    this.y = y;
    this.article = article;
    this.facing = facing;
  }

  update(dt: number, canvasW: number) {
    this.x += (this.facing === 'right' ? this.speed : -this.speed) * dt;
    this.y += this.vy * dt;
    if (this.x > canvasW + 20 || this.x < -20) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D) {
    const isDE = this.article === 'de';
    ctx.fillStyle = isDE ? COLORS.red : COLORS.white;
    ctx.fillRect(this.x, this.y - 2, 12, 4);
  }
}
