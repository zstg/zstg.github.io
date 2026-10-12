import { onMount, onCleanup } from 'solid-js';
import { subscribeFx, sizeCanvas } from '../../lib/fx-ticker';
import { readAccent, hsl, onThemeChange } from '../../lib/theme-colors';

/*
 * Data stream.
 *
 * Rows of small blocks drifting upward, each row carrying its own slowly
 * mutating values. Blocks brighten and dim like a readout refreshing, with a
 * brighter "head" block on each row so the upward motion is legible. Pairs
 * with the monospace type on the site.
 */
const GLYPHS = 8;

export default function DataStream(props: { rows?: number; cell?: number }) {
  let canvas!: HTMLCanvasElement;

  onMount(() => {
    const ctx = canvas.getContext('2d')!;
    const ROW_H = props.cell ?? 22;

    let W = 0,
      H = 0;
    let accent = readAccent();
    const offTheme = onThemeChange(() => {
      accent = readAccent();
    });

    type Row = { y: number; v: number[]; speed: number; phase: number; dim: number };
    let rows: Row[] = [];

    function resize() {
      const s = sizeCanvas(canvas, 1.25);
      W = s.W;
      H = s.H;
      const n = Math.ceil(H / ROW_H) + 2;
      rows = Array.from({ length: n }, () => ({
        y: Math.random() * H,
        v: Array.from({ length: GLYPHS }, () => Math.random()),
        speed: 8 + Math.random() * 34,
        phase: Math.random() * Math.PI * 2,
        dim: 0.25 + Math.random() * 0.75,
      }));
    }
    resize();
    window.addEventListener('resize', resize);

    const stop = subscribeFx((dt, t) => {
      ctx.clearRect(0, 0, W, H);

      const cellW = W / GLYPHS;
      const pad = cellW * 0.22;
      const bw = cellW - pad * 2;

      for (const row of rows) {
        row.y -= row.speed * dt;
        if (row.y < -ROW_H) {
          row.y = H + ROW_H;
          row.v = row.v.map(() => Math.random());
          row.speed = 8 + Math.random() * 34;
          row.dim = 0.25 + Math.random() * 0.75;
        }

        row.v.forEach((val, i) => {
          // each block's level drifts on its own slow cycle
          const lvl = 0.5 + 0.5 * Math.sin(t * (0.6 + val) + row.phase + i * 0.7);
          const h = ROW_H * 0.52 * (0.25 + lvl * 0.75);
          const x = i * cellW + pad;
          const y = row.y + (ROW_H - h) / 2;

          ctx.fillStyle = hsl(accent, 0.05 + lvl * 0.16 * row.dim, accent.l + lvl * 0.08);
          ctx.fillRect(x, y, bw, h);

          // bright cap on the leading edge of each block
          ctx.fillStyle = hsl(accent, 0.1 + lvl * 0.4 * row.dim, Math.min(1, accent.l + 0.18));
          ctx.fillRect(x, y + h - 1.5, bw, 1.5);
        });
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