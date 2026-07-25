"use client";

import { createParticleEngine, type Particle } from "./engine";

/**
 * Мост между системой частиц и холстом.
 *
 * Движок один на приложение и живёт вне React. Холст регистрирует себя при
 * монтировании; пока его нет, всплески просто копятся и гаснут — это дешевле,
 * чем проверять наличие холста на каждом тапе.
 */

interface Palette {
  readonly grain: string;
  readonly grainEdge: string;
  readonly score: string;
  readonly scoreFont: string;
}

interface Surface {
  readonly canvas: HTMLCanvasElement;
  readonly context: CanvasRenderingContext2D;
  readonly palette: Palette;
  rect: DOMRect;
  width: number;
  height: number;
}

/** Больше двух пикселей на точку не даёт видимой разницы, но стоит заливки. */
const MAX_PIXEL_RATIO = 2;

const SCORE_FONT_SIZE = 22;

export const particleEngine = createParticleEngine();

let surface: Surface | null = null;

export function attachSurface(canvas: HTMLCanvasElement): void {
  const context = canvas.getContext("2d");
  if (context === null) {
    return;
  }

  surface = {
    canvas,
    context,
    palette: readPalette(),
    rect: canvas.getBoundingClientRect(),
    width: 0,
    height: 0,
  };
  resizeSurface();
}

export function detachSurface(): void {
  particleEngine.clear();
  surface = null;
}

export function resizeSurface(): void {
  if (surface === null) {
    return;
  }

  const rect = surface.canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);

  surface.rect = rect;
  surface.width = rect.width;
  surface.height = rect.height;
  surface.canvas.width = Math.round(rect.width * ratio);
  surface.canvas.height = Math.round(rect.height * ratio);
  surface.context.setTransform(ratio, 0, 0, ratio, 0, 0);
}

/** Координаты приходят из события указателя, то есть в системе окна. */
export function burstAt(clientX: number, clientY: number, value: number, now: number): void {
  if (surface === null) {
    return;
  }
  particleEngine.burst(clientX - surface.rect.left, clientY - surface.rect.top, value, now);
}

export function renderParticles(now: number): void {
  particleEngine.step(now);

  if (surface === null) {
    return;
  }

  const { context, width, height, palette } = surface;
  context.clearRect(0, 0, width, height);

  for (const particle of particleEngine.particles) {
    if (!particle.active) {
      continue;
    }
    if (particle.kind === "grain") {
      drawGrain(context, particle, palette);
    } else {
      drawScore(context, particle, palette);
    }
  }
}

function drawGrain(context: CanvasRenderingContext2D, particle: Particle, palette: Palette): void {
  const progress = particle.age / particle.lifetime;
  const alpha = progress < 0.7 ? 1 : 1 - (progress - 0.7) / 0.3;

  context.save();
  context.globalAlpha = alpha;
  context.translate(particle.x, particle.y);
  context.rotate(particle.rotation);

  context.beginPath();
  context.ellipse(0, 0, particle.size * 0.62, particle.size, 0, 0, Math.PI * 2);
  context.fillStyle = palette.grain;
  context.fill();

  context.lineWidth = 1;
  context.strokeStyle = palette.grainEdge;
  context.stroke();

  context.restore();
}

function drawScore(context: CanvasRenderingContext2D, particle: Particle, palette: Palette): void {
  const progress = particle.age / particle.lifetime;
  const alpha = progress < 0.5 ? 1 : 1 - (progress - 0.5) / 0.5;
  // Небольшой наскок в начале: число как будто выпрыгивает из-под пальца.
  const scale = 0.8 + Math.min(1, progress * 6) * 0.25;

  context.save();
  context.globalAlpha = alpha;
  context.translate(particle.x, particle.y);
  context.scale(scale, scale);

  context.font = `700 ${SCORE_FONT_SIZE}px ${palette.scoreFont}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = palette.score;
  context.fillText(`+${Math.round(particle.value)}`, 0, 0);

  context.restore();
}

/** Цвета берутся из токенов, чтобы холст не разъезжался с остальным интерфейсом. */
function readPalette(): Palette {
  const styles = getComputedStyle(document.documentElement);
  const token = (name: string, fallback: string): string =>
    styles.getPropertyValue(name).trim() || fallback;

  return {
    grain: token("--rc-rice", "#fbf7ef"),
    grainEdge: "rgba(68, 34, 25, 0.18)",
    score: token("--rc-orange-bright", "#ff7a24"),
    scoreFont: token("--rc-font-display", "system-ui, sans-serif"),
  };
}
