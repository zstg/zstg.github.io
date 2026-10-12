import { onMount, onCleanup } from 'solid-js';
import { subscribeFx, sizeCanvas } from '../../lib/fx-ticker';
import { readAccent, hsl, onThemeChange } from '../../lib/theme-colors';

/*
 * Circuit tracing.
 *
 * A PCB-like board generated once with orthogonal traces and pads, then a
 * bright pulse travels along each trace so the "current" is visible. Traces
 * are dim accent; pulses are near-white accent, which reads as energised.
 */

/** Random per generation, so the board is different every time it is built. */
function rnd() {
  return Math.random();
}

interface Trace {
  pts: { x: number; y: number }[];
  len: number;
  offset: number;
  speed: number;
}

export default function CircuitTrace(props: { traces?: number }) {
  let canvas!: HTMLCanvasElement;

  onMount(() => {
    const ctx = canvas.getContext('2d')!;
    const COUNT = props.traces ?? 64;
    const GRID = 22;

    let W = 0,
      H = 0;
    let accent = readAccent();
    const offTheme = onThemeChange(() => {
      accent = readAccent();
    });

    let traces: Trace[] = [];

    function generate() {
      traces = [];
      // oversample the start points so the board covers the viewport evenly
      // rather than clumping; every trace still starts somewhere random.
      const cols = Math.ceil(W / GRID) + 4;
      const rows = Math.ceil(H / GRID) + 4;
      for (let n = 0; n < COUNT; n++) {
        const ci = Math.floor(rnd() * cols);
        const ri = Math.floor(rnd() * rows);
        let x = ci * GRID;
        let y = ri * GRID;
        const pts = [{ x, y }];
        let len = 0;
        // mix of long runs and short stubs -> reads as a real board
        const segs = 2 + Math.floor(rnd() * 7);
        for (let s = 0; s < segs; s++) {
          const horiz = rnd() < 0.5;
          const dir = rnd() < 0.5 ? -1 : 1;
          const steps = 1 + Math.floor(rnd() * 7);
          if (horiz) x += dir * GRID * steps;
          else y += dir * GRID * steps;
          pts.push({ x, y });
          len += GRID * steps;
        }
        traces.push({
          pts,
          len,
          offset: rnd() * (len + 200),
          speed: 40 + rnd() * 110,
        });
      }
    }

    function resize() {
      const s = sizeCanvas(canvas, 1.5);
      W = s.W;
      H = s.H;
      generate();
    }
    resize();
    window.addEventListener('resize', resize);

    const stop = subscribeFx((dt, t) => {
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 1.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const shiftX = -20;
      const shiftY = -20;

      // board traces (dim)
      ctx.strokeStyle = hsl(accent, 0.11, accent.l * 0.85);
      for (const tr of traces) {
        ctx.beginPath();
        tr.pts.forEach((p, i) => {
          const x = p.x + shiftX;
          const y = p.y + shiftY;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }

      // pads at every vertex
      ctx.fillStyle = hsl(accent, 0.16, accent.l * 0.9);
      for (const tr of traces) {
        for (const p of tr.pts) {
          ctx.beginPath();
          ctx.arc(p.x + shiftX, p.y + shiftY, 2.1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // travelling pulses
      for (const tr of traces) {
        const total = tr.len + 160;
        // a couple of pulses per trace, evenly spread
        for (let k = 0; k < 2; k++) {
          const d = ((t * tr.speed + tr.offset + k * (total / 2)) % total) - 80;
          if (d < 0 || d > tr.len) continue;

          // walk the polyline to find the point at distance d
          let acc = 0;
          for (let i = 1; i < tr.pts.length; i++) {
            const a = tr.pts[i - 1];
            const b = tr.pts[i];
            const seg = Math.hypot(b.x - a.x, b.y - a.y);
            if (acc + seg >= d) {
              const f = seg === 0 ? 0 : (d - acc) / seg;
              const x = a.x + (b.x - a.x) * f + shiftX;
              const y = a.y + (b.y - a.y) * f + shiftY;
              const fade = Math.sin((d / tr.len) * Math.PI); // brightest mid-trace
              const g = ctx.createRadialGradient(x, y, 0, x, y, 13);
              g.addColorStop(0, hsl(accent, 0.75 * fade, Math.min(1, accent.l + 0.3)));
              g.addColorStop(1, hsl(accent, 0));
              ctx.fillStyle = g;
              ctx.beginPath();
              ctx.arc(x, y, 13, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = hsl(accent, 0.95 * fade, Math.min(1, accent.l + 0.4));
              ctx.beginPath();
              ctx.arc(x, y, 1.6, 0, Math.PI * 2);
              ctx.fill();
              break;
            }
            acc += seg;
          }
        }
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