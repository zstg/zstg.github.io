import { onMount, onCleanup } from 'solid-js';
import { subscribeFx, sizeCanvas } from '../../lib/fx-ticker';
import { readAccent, hsl, onThemeChange } from '../../lib/theme-colors';
import { globeOpenAtDistance } from '../../lib/fx-globe';

/*
 * Shape morph.
 *
 * The shape-morphing hero graphics from Material 3 Expressive: rounded forms
 * drifting and slowly morphing between a circle and a squircle. Corner radius
 * is animated per shape, so one form reads as a disc and later as a rounded
 * square without ever being a different object.
 *
 * NOTE: Canvas2D bakes path coordinates into the path at construction time,
 * so the transform has to be applied BEFORE beginPath(). Setting it afterwards
 * silently draws everything at the origin.
 */
interface Shape {
  x: number;
  y: number;
  size: number;
  rot: number;
  vrot: number;
  vx: number;
  vy: number;
  phase: number;
  speed: number;
  weight: number;
}

/**
 * Rounded square centred on the origin. Radius 0 = square, half = circle.
 *
 * `ctx` is passed in rather than closed over: this lives at module scope, and
 * capturing the component's context from out here silently produced a
 * ReferenceError that `astro build` does not catch (it does not type-check).
 */
function roundedSquare(ctx: CanvasRenderingContext2D, s: number, r: number) {
  const k = Math.min(r, s);
  ctx.beginPath();
  ctx.moveTo(-s + k, -s);
  ctx.lineTo(s - k, -s);
  ctx.arcTo(s, -s, s, -s + k, k);
  ctx.lineTo(s, s - k);
  ctx.arcTo(s, s, s - k, s, k);
  ctx.lineTo(-s + k, s);
  ctx.arcTo(-s, s, -s, s - k, k);
  ctx.lineTo(-s, -s + k);
  ctx.arcTo(-s, -s, -s + k, -s, k);
  ctx.closePath();
}

export default function ShapeMorph(props: { shapes?: number }) {
  let canvas!: HTMLCanvasElement;
  let ctx!: CanvasRenderingContext2D;

  onMount(() => {
    ctx = canvas.getContext('2d')!;
    const COUNT = props.shapes ?? 16;

    let W = 0,
      H = 0;
    let accent = readAccent();
    const offTheme = onThemeChange(() => {
      accent = readAccent();
    });

    const shapes: Shape[] = Array.from({ length: COUNT }, () => ({
      x: Math.random(),
      y: Math.random(),
      size: 70 + Math.random() * 230,
      rot: Math.random() * Math.PI,
      vrot: (Math.random() - 0.5) * 0.14,
      vx: (Math.random() - 0.5) * 0.028,
      vy: (Math.random() - 0.5) * 0.028,
      phase: Math.random() * Math.PI * 2,
      speed: 0.15 + Math.random() * 0.35,
      weight: 0.3 + Math.random() * 0.7,
    }));

    function resize() {
      const s = sizeCanvas(canvas, 1.25);
      W = s.W;
      H = s.H;
    }
    resize();
    window.addEventListener('resize', resize);

    const stop = subscribeFx((dt, t) => {
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 1.3;

      for (const sh of shapes) {
        sh.x += sh.vx * dt;
        sh.y += sh.vy * dt;
        sh.rot += sh.vrot * dt;

        // wrap with a margin so shapes enter and leave off-screen
        const padX = sh.size / 2 / W + 0.02;
        const padY = sh.size / 2 / H + 0.02;
        if (sh.x < -padX) sh.x = 1 + padX;
        if (sh.x > 1 + padX) sh.x = -padX;
        if (sh.y < -padY) sh.y = 1 + padY;
        if (sh.y > 1 + padY) sh.y = -padY;

        // morph: 0 = circle, 1 = nearly square
        const m = 0.5 + 0.5 * Math.sin(t * sh.speed + sh.phase);
        const half = sh.size / 2;
        const r = half * (1 - m * 0.94);
        const breathe = 0.5 + 0.5 * Math.sin(t * sh.speed * 0.7 + sh.phase * 1.7);

        const cx = sh.x * W;
        const cy = sh.y * H;
        // Fade out over the sphere so the globe and hero copy stay legible.
        // Uses the shape's NEAREST point, not its centre: these forms are up
        // to 300px across and would otherwise reach well inside the zone
        // while their origin sits outside it.
        const dCentre = Math.hypot(cx - W / 2, cy - H / 2);
        const open = globeOpenAtDistance(Math.max(0, dCentre - half * 1.45), W, H);
        if (open <= 0.03) continue;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(sh.rot);
        roundedSquare(ctx, half, r);
        ctx.fillStyle = hsl(accent, (0.02 + 0.022 * breathe) * open, accent.l);
        ctx.fill();
        ctx.strokeStyle = hsl(
          accent,
          (0.045 + 0.085 * breathe * sh.weight) * open,
          accent.l + 0.04
        );
        ctx.stroke();
        ctx.restore();
      }
    }, 30);

    onCleanup(() => {
      stop();
      offTheme();
      window.removeEventListener('resize', resize);
    });
  });

  return <canvas ref={canvas} class="absolute inset-0 w-full h-full" aria-hidden="true" />;
}