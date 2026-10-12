import { onMount, onCleanup } from 'solid-js';
import { subscribeFx, sizeCanvas } from '../../lib/fx-ticker';
import { readAccent, hsl, onThemeChange } from '../../lib/theme-colors';

/*
 * Mesh gradient.
 *
 * A few very large, very soft radial blobs drifting across the screen in the
 * accent hue. This is the closest thing here to a classic "Material You"
 * background: no geometry at all, just colour bleeding around in the dark.
 *
 * Drawn additively so the blobs lighten the backdrop rather than muddy it,
 * and rendered on a coarse offscreen buffer that is scaled up - a full-res
 * radial-gradient fill every frame is far more expensive than the result
 * needs to be.
 */
export default function MeshGradient(props: { blobs?: number }) {
  let canvas!: HTMLCanvasElement;

  onMount(() => {
    const ctx = canvas.getContext('2d')!;
    const BLOBS = props.blobs ?? 5;
    const SCALE = 0.18; // offscreen resolution divisor

    let W = 0,
      H = 0;
    let accent = readAccent();
    const offTheme = onThemeChange(() => {
      accent = readAccent();
    });

    const off = document.createElement('canvas');
    const octx = off.getContext('2d')!;

    function resize() {
      const s = sizeCanvas(canvas, 1);
      W = s.W;
      H = s.H;
      off.width = Math.max(1, Math.round(W * SCALE));
      off.height = Math.max(1, Math.round(H * SCALE));
    }
    resize();
    window.addEventListener('resize', resize);

    // each blob drifts on its own slow lissajous path
    const blobs = Array.from({ length: BLOBS }, (_, i) => ({
      ax: 0.22 + Math.random() * 0.3,
      ay: 0.2 + Math.random() * 0.3,
      cx: Math.random(),
      cy: Math.random(),
      fx: 0.05 + Math.random() * 0.08,
      fy: 0.04 + Math.random() * 0.07,
      px: Math.random() * Math.PI * 2,
      py: Math.random() * Math.PI * 2,
      size: 0.3 + Math.random() * 0.34,
      a: 0.1 + Math.random() * 0.1,
      hueShift: (i % 3) * 14 - 14,
    }));

    const stop = subscribeFx((_dt, t) => {
      const ow = off.width;
      const oh = off.height;
      octx.clearRect(0, 0, ow, oh);
      octx.globalCompositeOperation = 'lighter';

      for (const b of blobs) {
        const x = (b.cx + Math.cos(t * b.fx + b.px) * b.ax) * ow;
        const y = (b.cy + Math.sin(t * b.fy + b.py) * b.ay) * oh;
        const r = b.size * Math.max(ow, oh);
        const g = octx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, hsl(accent, b.a, Math.min(0.78, accent.l + 0.06), b.hueShift));
        g.addColorStop(0.55, hsl(accent, b.a * 0.35, accent.l, b.hueShift));
        g.addColorStop(1, hsl(accent, 0, accent.l, b.hueShift));
        octx.fillStyle = g;
        octx.fillRect(x - r, y - r, r * 2, r * 2);
      }

      octx.globalCompositeOperation = 'source-over';

      ctx.clearRect(0, 0, W, H);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(off, 0, 0, W, H);
      // Deliberately NOT filled with the theme background: this canvas shares
      // a stacking context with the particle sphere, so an opaque fill would
      // hide the sphere behind it. The blobs composite additively over whatever
      // is already there instead.
    }, 30);

    onCleanup(() => {
      stop();
      offTheme();
      window.removeEventListener('resize', resize);
    });
  });

  return <canvas ref={canvas} class="absolute inset-0 w-full h-full" aria-hidden="true" />;
}