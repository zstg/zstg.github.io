import { onMount, onCleanup } from 'solid-js';
import { subscribeFx, sizeCanvas } from '../../lib/fx-ticker';
import { readAccent, hsl, onThemeChange } from '../../lib/theme-colors';

/*
 * Dot matrix - the interactive one.
 *
 * A regular Material-style dot grid sits at very low opacity. It only lights
 * up near the pointer: within RADIUS the dots take the accent colour, grow,
 * and gain a glow, falling off smoothly to nothing at the edge. Move away and
 * they fade back to the idle grid.
 *
 * The idle grid is deliberately faint (a few percent alpha) so it never
 * competes with text; all the visible energy is local to the cursor.
 */
export default function DotMatrix(props: { spacing?: number; radius?: number }) {
  let canvas!: HTMLCanvasElement;

  onMount(() => {
    const ctx = canvas.getContext('2d')!;
    const SPACING = props.spacing ?? 26;
    const RADIUS = props.radius ?? 190;

    let W = 0,
      H = 0;
    let accent = readAccent();
    let offTheme = onThemeChange(() => {
      accent = readAccent();
    });

    function resize() {
      const s = sizeCanvas(canvas, 2);
      W = s.W;
      H = s.H;
    }
    resize();
    window.addEventListener('resize', resize);

    // pointer position + smoothed follow, so the glow trails the cursor a little
    let px = -9999,
      py = -9999;
    let tx = -9999,
      ty = -9999;
    let active = false;

    function onMove(e: PointerEvent) {
      tx = e.clientX;
      ty = e.clientY;
      active = true;
    }
    function onLeave() {
      active = false;
    }
    function onTouch(e: TouchEvent) {
      const t = e.touches[0];
      if (!t) return;
      tx = t.clientX;
      ty = t.clientY;
      active = true;
    }
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerleave', onLeave);
    window.addEventListener('touchmove', onTouch, { passive: true });

    const stop = subscribeFx((dt) => {
      const lerp = 1 - Math.pow(0.0001, dt);
      px += (tx - px) * lerp;
      py += (ty - py) * lerp;

      ctx.clearRect(0, 0, W, H);

      const cols = Math.ceil(W / SPACING) + 1;
      const rows = Math.ceil(H / SPACING) + 1;
      const offX = (W - (cols - 1) * SPACING) / 2;
      const offY = (H - (rows - 1) * SPACING) / 2;
      const r2 = RADIUS * RADIUS;

      for (let j = 0; j < rows; j++) {
        const y = offY + j * SPACING;
        const dy = y - py;
        for (let i = 0; i < cols; i++) {
          const x = offX + i * SPACING;
          const dx = x - px;
          const d2 = dx * dx + dy * dy;

          if (!active || d2 > r2) {
            // idle: barely-there dot
            ctx.fillStyle = hsl(accent, 0.05, accent.l * 0.8);
            ctx.beginPath();
            ctx.arc(x, y, 1, 0, Math.PI * 2);
            ctx.fill();
          } else {
            const d = Math.sqrt(d2);
            const f = 1 - d / RADIUS; // 1 at the cursor, 0 at the edge
            const ease = f * f * (3 - 2 * f); // smoothstep falloff
            const rad = 1 + ease * 3.1;
            const a = 0.08 + ease * 0.85;

            // glow: a wide, very soft halo behind the dot
            if (ease > 0.02) {
              const g = ctx.createRadialGradient(x, y, 0, x, y, rad * 5);
              g.addColorStop(0, hsl(accent, a * 0.5));
              g.addColorStop(1, hsl(accent, 0));
              ctx.fillStyle = g;
              ctx.beginPath();
              ctx.arc(x, y, rad * 5, 0, Math.PI * 2);
              ctx.fill();
            }

            ctx.fillStyle = hsl(accent, a, accent.l + ease * 0.12);
            ctx.beginPath();
            ctx.arc(x, y, rad, 0, Math.PI * 2);
            ctx.fill();
          }
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