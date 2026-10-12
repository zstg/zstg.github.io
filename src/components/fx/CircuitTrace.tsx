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

/** Small deterministic PRNG so the board looks the same across resizes. */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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
    const COUNT = props.traces ?? 16;
    const GRID = 26;

    let W = 0,
      H = 0;
    let accent = readAccent();
    const offTheme = onThemeChange(() => {
      accent = readAccent();
    });

    let traces: Trace[] = [];

    function generate() {
      const rnd = mulberry32(0x5eed);
      traces = [];
      const cols = Math.ceil(W / GRID) + 2;
      const rows = Math.ceil(H / GRID) + 2;
      for (let n = 0; n < COUNT; n++) {
        let ci = Math.floor(rnd() * cols);
        let ri = Math.floor(rnd() * rows);
        let x = ci * GRID;
        let y = ri * GRID;
        const pts = [{ x, y }];
        let len = 0;
        const segs = 3 + Math.floor(rnd() * 5);
        for (let s = 0; s < segs; s++) {
          const horiz = rnd() < 0.5;
          const dir = rnd() < 0.5 ? -1 : 1;
          const steps = 2 + Math.floor(rnd() * 6);
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