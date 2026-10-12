import { onMount, onCleanup } from 'solid-js';
import { subscribeFx, sizeCanvas } from '../../lib/fx-ticker';
import { readAccent, hsl, onThemeChange } from '../../lib/theme-colors';

/*
 * Honeycomb.
 *
 * A hex lattice that drifts slowly across the screen, drawn as thin accent
 * outlines. A scattering of cells is filled at low opacity, and a few "bees"
 * wander between neighbouring cell centres so the grid never feels static.
 */
export default function Honeycomb(props: { cell?: number }) {
  let canvas!: HTMLCanvasElement;

  onMount(() => {
    const ctx = canvas.getContext('2d')!;
    const R = props.cell ?? 34; // hex circumradius
    const w = Math.sqrt(3) * R; // hex width
    const h = 1.5 * R; // vertical step between rows

    let W = 0,
      H = 0;
    let accent = readAccent();
    const offTheme = onThemeChange(() => {
      accent = readAccent();
    });

    function resize() {
      const s = sizeCanvas(canvas, 1.5);
      W = s.W;
      H = s.H;
    }
    resize();
    window.addEventListener('resize', resize);

    /*
     * Per-cell lighting.
     *
     * Cells used to be lit/unlit from a Set chosen once, which froze the
     * pattern. Now every cell derives a stable phase from its lattice
     * coordinates via a hash, so it keeps the same identity across frames
     * (no flicker) while breathing on its own cycle. Only a minority are
     * bright at any moment, so the lattice reads as alive rather than
     * uniformly lit.
     */
    const hash = (i: number, j: number) => {
      const n = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
      return n - Math.floor(n); // 0..1
    };

    // bees: wander between neighbouring hex centres
    const BEES = 7;
    const bees = Array.from({ length: BEES }, () => ({
      x: Math.random(),
      y: Math.random(),
      a: Math.random() * Math.PI * 2,
      s: 0.04 + Math.random() * 0.05,
      turn: (Math.random() - 0.5) * 1.6,
      phase: Math.random() * Math.PI * 2,
    }));

    function hexPath(x: number, y: number) {
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (Math.PI / 3) * k - Math.PI / 6;
        const px = x + Math.cos(a) * R;
        const py = y + Math.sin(a) * R;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    }

    const stop = subscribeFx((dt, t) => {
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 1;

      const drift = t * 6;
      const dx = drift % w;
      const dy = (drift * 0.6) % h;

      // lattice: outline every hex, brightening where that cell is charged
      const cols = Math.ceil(W / w) + 3;
      const rows = Math.ceil(H / h) + 3;

      const cellCentre = (i: number, j: number) => ({
        x: i * w + (j % 2 === 0 ? 0 : w / 2) - dx,
        y: j * h - dy,
      });

      /*
       * Two passes so a cell can be brightened without redrawing the whole
       * lattice stroke colour per cell: stroke everything dim, then fill the
       * charged cells on top.
       */
      ctx.strokeStyle = hsl(accent, 0.08, accent.l * 0.9);
      for (let j = -1; j < rows; j++) {
        for (let i = -1; i < cols; i++) {
          const { x, y } = cellCentre(i, j);
          hexPath(x, y);
          ctx.stroke();
        }
      }

      // charged cells, each on its own cycle
      for (let j = -1; j < rows; j++) {
        for (let i = -1; i < cols; i++) {
          const r1 = hash(i, j);
          const r2 = hash(j + 91.3, i - 17.7);
          // ~45% of cells ever charge; the rest stay as plain outline
          if (r1 > 0.45) continue;
          // each cell has its own speed and offset
          const cycle = Math.sin(t * (0.35 + r2 * 0.75) + r2 * Math.PI * 2);
          if (cycle <= 0.15) continue;
          const charge = Math.pow((cycle - 0.15) / 0.85, 1.7);

          const { x, y } = cellCentre(i, j);
          hexPath(x, y);
          ctx.fillStyle = hsl(accent, 0.04 + charge * 0.24, accent.l + charge * 0.08);
          ctx.fill();

          // the outline itself lights up too
          ctx.strokeStyle = hsl(accent, 0.06 + charge * 0.3, accent.l + charge * 0.1);
          ctx.stroke();
        }
      }
      ctx.strokeStyle = hsl(accent, 0.08, accent.l * 0.9);

      // bees
      for (const b of bees) {
        b.a += b.turn * dt;
        b.x += Math.cos(b.a) * b.s * dt;
        b.y += Math.sin(b.a) * b.s * dt;
        // wrap around the screen
        if (b.x < -0.05) b.x = 1.05;
        if (b.x > 1.05) b.x = -0.05;
        if (b.y < -0.05) b.y = 1.05;
        if (b.y > 1.05) b.y = -0.05;

        const x = b.x * W + Math.cos(t * 1.6 + b.phase) * 6;
        const y = b.y * H + Math.sin(t * 1.3 + b.phase) * 6;

        const g = ctx.createRadialGradient(x, y, 0, x, y, 11);
        g.addColorStop(0, hsl(accent, 0.55, Math.min(1, accent.l + 0.2)));
        g.addColorStop(1, hsl(accent, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, 11, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = hsl(accent, 0.85, Math.min(1, accent.l + 0.25));
        ctx.beginPath();
        ctx.arc(x, y, 1.7, 0, Math.PI * 2);
        ctx.fill();
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