import { onMount, onCleanup } from 'solid-js';
import { subscribeFx, sizeCanvas } from '../../lib/fx-ticker';
import { readAccent, hsl, onThemeChange } from '../../lib/theme-colors';

/*
 * Shape morph.
 *
 * The shape-morphing hero graphics from Material 3 Expressive: a handful of
 * large rounded forms drifting and slowly morphing between a circle and a
 * squircle. Corner radius is animated per shape, so one form reads as a disc
 * and later as a rounded square without ever being a different object.
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

export default function ShapeMorph(props: { shapes?: number }) {
  let canvas!: HTMLCanvasElement;

  onMount(() => {
    const ctx = canvas.getContext('2d')!;
    const COUNT = props.shapes ?? 7;

    let W = 0,
      H = 0;
    let accent = readAccent();
    const offTheme = onThemeChange(() => {
      accent = readAccent();
    });

    const shapes: Shape[] = Array.from({ length: COUNT }, () => ({
      x: Math.random(),
      y: Math.random(),
      size: 90 + Math.random() * 190,
      rot: Math.random() * Math.PI,
      vrot: (Math.random() - 0.5) * 0.12,
      vx: (Math.random() - 0.5) * 0.02,
      vy: (Math.random() - 0.5) * 0.02,
      phase: Math.random() * Math.PI * 2,
      speed: 0.15 + Math.random() * 0.3,
      weight: 0.2 + Math.random() * 0.8,
    }));

    function resize() {
      const s = sizeCanvas(canvas, 1.25);
      W = s.W;
      H = s.H;
    }
    resize();
    window.addEventListener('resize', resize);

    /** Rounded-rect path whose corners animate between round and square. */
    function morphPath(cx: number, cy: number, half: number, r: number, rot: number) {
      const s = half;
      ctx.beginPath();
      const pts = [
        [-s + r, -s],
        [s - r, -s],
        [s, -s + r],
        [s, s - r],
        [s - r, s],
        [-s + r, s],
        [-s, s - r],
        [-s, -s + r],
      ];
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) {
        const [px, py] = pts[i];
        const prev = pts[i - 1];
        ctx.arcTo(prev[0], prev[1], px, py, r);
        ctx.lineTo(px, py);
      }
      ctx.closePath();
      // rotate around the centre
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.translate(-cx, -cy);
    }

    const stop = subscribeFx((dt, t) => {
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 1.3;

      for (const sh of shapes) {
        sh.x += sh.vx * dt;
        sh.y += sh.vy * dt;
        sh.rot += sh.vrot * dt;
        // wrap around the viewport
        const pad = sh.size / W + 0.15;
        if (sh.x < -pad) sh.x = 1 + pad;
        if (sh.x > 1 + pad) sh.x = -pad;
        if (sh.y < -pad) sh.y = 1 + pad;
        if (sh.y > 1 + pad) sh.y = -pad;

        // morph: 0 = circle, 1 = nearly square
        const m = 0.5 + 0.5 * Math.sin(t * sh.speed + sh.phase);
        const half = sh.size / 2;
        const r = half * (1 - m * 0.92);

        const cx = sh.x * W;
        const cy = sh.y * H;
        const breathe = 0.5 + 0.5 * Math.sin(t * sh.speed * 0.7 + sh.phase * 1.7);

        ctx.save();
        morphPath(cx, cy, half, r, sh.rot);
        ctx.fillStyle = hsl(accent, 0.035 + 0.03 * breathe, accent.l);
        ctx.fill();
        ctx.strokeStyle = hsl(accent, (0.1 + 0.16 * breathe) * sh.weight + 0.05, accent.l);
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