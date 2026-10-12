import { onMount, onCleanup } from 'solid-js';
import { subscribeFx, sizeCanvas } from '../../lib/fx-ticker';
import { readAccent, hsl, onThemeChange } from '../../lib/theme-colors';

/*
 * Constellation.
 *
 * Drifting nodes joined by faint lines when they come close, with brighter
 * nodes that occasionally pulse. A little local repulsion keeps the web from
 * collapsing into a clump.
 */
interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  phase: number;
}

export default function Constellation(props: { nodes?: number; linkDist?: number }) {
  let canvas!: HTMLCanvasElement;

  onMount(() => {
    const ctx = canvas.getContext('2d')!;
    const COUNT = props.nodes ?? 78;

    let W = 0,
      H = 0;
    let accent = readAccent();
    const offTheme = onThemeChange(() => {
      accent = readAccent();
    });

    const nodes: Node[] = Array.from({ length: COUNT }, () => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.03,
      vy: (Math.random() - 0.5) * 0.03,
      r: 0.8 + Math.random() * 1.6,
      phase: Math.random() * Math.PI * 2,
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
      const LINK = props.linkDist ?? 150;
      const link2 = LINK * LINK;

      for (const n of nodes) {
        n.x += n.vx * dt;
        n.y += n.vy * dt;
        if (n.x < 0) { n.x = 0; n.vx *= -1; }
        if (n.x > 1) { n.x = 1; n.vx *= -1; }
        if (n.y < 0) { n.y = 0; n.vy *= -1; }
        if (n.y > 1) { n.y = 1; n.vy *= -1; }
      }

      // soft separation so nodes spread out instead of clumping
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = (a.x - b.x) * W;
          const dy = (a.y - b.y) * H;
          const d2 = dx * dx + dy * dy;
          if (d2 > 0.0001 && d2 < (55 * 55)) {
            const d = Math.sqrt(d2);
            const push = ((55 - d) / 55) * 0.00035;
            const ux = (dx / d) * push;
            const uy = (dy / d) * push;
            a.vx += ux * 60 * dt * 10;
            a.vy += uy * 60 * dt * 10;
            b.vx -= ux * 60 * dt * 10;
            b.vy -= uy * 60 * dt * 10;
          }
        }
      }

      // links
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = (a.x - b.x) * W;
          const dy = (a.y - b.y) * H;
          const d2 = dx * dx + dy * dy;
          if (d2 > link2) continue;
          const f = 1 - Math.sqrt(d2) / LINK;
          ctx.strokeStyle = hsl(accent, f * f * 0.3, accent.l + f * 0.06);
          ctx.beginPath();
          ctx.moveTo(a.x * W, a.y * H);
          ctx.lineTo(b.x * W, b.y * H);
          ctx.stroke();
        }
      }

      // nodes
      for (const n of nodes) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 1.1 + n.phase);
        const x = n.x * W;
        const y = n.y * H;
        const r = n.r + pulse * 1.1;
        if (pulse > 0.55) {
          const g = ctx.createRadialGradient(x, y, 0, x, y, r * 7);
          g.addColorStop(0, hsl(accent, (pulse - 0.55) * 0.4, accent.l));
          g.addColorStop(1, hsl(accent, 0));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, r * 7, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = hsl(accent, 0.22 + pulse * 0.45, accent.l + pulse * 0.12);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
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