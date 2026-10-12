import { onMount, onCleanup } from 'solid-js';
import { subscribeFx, sizeCanvas } from '../../lib/fx-ticker';
import { readAccent, hsl, onThemeChange } from '../../lib/theme-colors';

/*
 * Contour lines.
 *
 * Topographic-style bands from a slowly evolving sum of sine fields, in the
 * spirit of the layered hero graphics used in Material 3 Expressive. Each
 * band is stroked thin; alpha rises toward the middle of the field so it has
 * depth rather than reading as a flat grid.
 */
export default function ContourLines(props: { bands?: number }) {
  let canvas!: HTMLCanvasElement;

  onMount(() => {
    const ctx = canvas.getContext('2d')!;
    const BANDS = props.bands ?? 26;

    let W = 0,
      H = 0;
    let accent = readAccent();
    const offTheme = onThemeChange(() => {
      accent = readAccent();
    });

    function resize() {
      const s = sizeCanvas(canvas, 1.25);
      W = s.W;
      H = s.H;
    }
    resize();
    window.addEventListener('resize', resize);

    const stop = subscribeFx((_dt, t) => {
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 1;

      const STEP = 9;
      const cols = Math.ceil(W / STEP) + 1;
      const rows = Math.ceil(H / STEP) + 1;
      const a1 = t * 0.13;
      const a2 = t * 0.09;

      for (let b = 0; b < BANDS; b++) {
        const level = b * 0.055;
        // fade the outer bands so the field has a soft edge
        const edge = 1 - Math.abs(level - (BANDS * 0.055) / 2) / ((BANDS * 0.055) / 2);
        ctx.strokeStyle = hsl(accent, 0.05 + 0.07 * Math.max(0, edge));
        ctx.beginPath();
        for (let j = 0; j < rows; j++) {
          const y = j * STEP;
          for (let i = 0; i < cols; i++) {
            const x = i * STEP;
            const v =
              Math.sin(x * 0.006 + a1) * 1.0 +
              Math.sin(y * 0.0055 - a2) * 0.9 +
              Math.sin((x + y) * 0.0034 + a1 * 0.7) * 0.7 +
              Math.sin(Math.hypot(x - W / 2, y - H / 2) * 0.004 - a2 * 1.3) * 1.3;
            if (Math.abs(v - level) < 0.045) {
              if (i === 0 && j === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
          }
        }
        ctx.stroke();
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