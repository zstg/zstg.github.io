import { onMount, onCleanup } from 'solid-js';
import { subscribeFx, sizeCanvas } from '../../lib/fx-ticker';
import { readAccent, hsl, onThemeChange } from '../../lib/theme-colors';

/*
 * Radiant dot matrix.
 *
 * The same grid as DotMatrix, but instead of a static pool of light around the
 * cursor, rings of illumination travel outward from it continuously - a
 * repeating radial wave, as if the cursor were dropping stones on a pond.
 *
 * Each dot's brightness is the sum of:
 *   - a soft core glow that follows the cursor, and
 *   - concentric wavefronts at radius (t * speed - distance), which is what
 *     produces the ripple. Because the wave is periodic in distance, rings
 *     repeat forever without any per-ring bookkeeping.
 */
export default function RadiantDotMatrix(props: { spacing?: number; speed?: number }) {
  let canvas!: HTMLCanvasElement;

  onMount(() => {
    const ctx = canvas.getContext('2d')!;
    const SPACING = props.spacing ?? 24;
    const SPEED = props.speed ?? 130; // px/sec the wavefront travels
    const WAVELEN = 150; // px between successive rings

    let W = 0,
      H = 0;
    let accent = readAccent();
    const offTheme = onThemeChange(() => {
      accent = readAccent();
    });

    function resize() {
      const s = sizeCanvas(canvas, 2);
      W = s.W;
      H = s.H;
    }
    resize();
    window.addEventListener('resize', resize);

    let tx = -9999,
      ty = -9999;
    let px = -9999,
      py = -9999;
    let active = false;

    const onMove = (e: PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      active = true;
    };
    const onLeave = () => {
      active = false;
    };
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      tx = t.clientX;
      ty = t.clientY;
      active = true;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerleave', onLeave);
    window.addEventListener('touchmove', onTouch, { passive: true });

    const stop = subscribeFx((dt, t) => {
      const lerp = 1 - Math.pow(0.0001, dt);
      px += (tx - px) * lerp;
      py += (ty - py) * lerp;

      ctx.clearRect(0, 0, W, H);

      const cols = Math.ceil(W / SPACING) + 1;
      const rows = Math.ceil(H / SPACING) + 1;
      const offX = (W - (cols - 1) * SPACING) / 2;
      const offY = (H - (rows - 1) * SPACING) / 2;
      const head = t * SPEED; // how far the wavefront has travelled

      for (let j = 0; j < rows; j++) {
        const y = offY + j * SPACING;
        const dy = y - py;
        for (let i = 0; i < cols; i++) {
          const x = offX + i * SPACING;
          const dx = x - px;
          const d = Math.hypot(dx, dy);

          if (!active) {
            ctx.fillStyle = hsl(accent, 0.05, accent.l * 0.8);
            ctx.beginPath();
            ctx.arc(x, y, 1, 0, Math.PI * 2);
            ctx.fill();
            continue;
          }

          // core glow near the cursor
          const core = Math.max(0, 1 - d / 130);
          const coreE = core * core;

          /*
           * Wavefronts. `w` is how many wavelengths this dot sits behind the
           * leading edge; folding it into 0..1 and taking a narrow peak gives
           * a ring that travels outward.
           */
          const w = (d - head) / WAVELEN;
          const f = ((w % 1) + 1) % 1; // 0..1
          // sharp peak at the wavefront, fading as the ring expands
          const ring = Math.pow(1 - f, 8);
          // rings dim with distance so they don't wash out the whole screen
          const reach = Math.max(0, 1 - d / 900);
          const ringE = ring * reach;

          const e = Math.min(1, coreE * 0.9 + ringE);
          if (e < 0.02) {
            ctx.fillStyle = hsl(accent, 0.05, accent.l * 0.8);
            ctx.beginPath();
            ctx.arc(x, y, 1, 0, Math.PI * 2);
            ctx.fill();
            continue;
          }

          const rad = 1 + e * 3.4;
          const a = 0.07 + e * 0.8;

          if (e > 0.05) {
            const g = ctx.createRadialGradient(x, y, 0, x, y, rad * 5.5);
            g.addColorStop(0, hsl(accent, a * 0.45));
            g.addColorStop(1, hsl(accent, 0));
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(x, y, rad * 5.5, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.fillStyle = hsl(accent, a, accent.l + e * 0.12);
          ctx.beginPath();
          ctx.arc(x, y, rad, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }, 60);

    onCleanup(() => {
      stop();
      offTheme();
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('touchmove', onTouch);
    });
  });

  return <canvas ref={canvas} class="absolute inset-0 w-full h-full" aria-hidden="true" />;
}