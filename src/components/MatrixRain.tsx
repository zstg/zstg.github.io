import { onMount, onCleanup } from 'solid-js';

/*
 * Matrix rain.
 *
 * Columns of falling glyphs drawn on a 2D canvas. Deliberately faint and
 * desaturated so it reads as texture rather than content: text on top of it
 * stays comfortably legible.
 */

const GLYPHS =
  'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789ABCDEFZ:;<=>*+-·';

export default function MatrixRain() {
  let canvas!: HTMLCanvasElement;
  let raf = 0;

  onMount(() => {
    const ctx = canvas.getContext('2d')!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let W = 0;
    let H = 0;
    let fontSize = 15;
    let cols = 0;
    let drops: number[] = [];
    let speeds: number[] = [];
    let trails: { ch: string; life: number }[][] = [];

    const readAccent = () => {
      const v = getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim();
      const h = v.match(/hsla?\(\s*([\d.]+)[\s,]+([\d.]+)%[\s,]+([\d.]+)%/i);
      if (h) return { h: Number(h[1]), s: Number(h[2]) / 100, l: Number(h[3]) / 100 };
      const hex = v.match(/^#([0-9a-f]{6})$/i);
      if (hex) {
        const n = parseInt(hex[1], 16);
        return { h: 0, s: 0, l: 0, r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
      }
      return { h: 222, s: 0.75, l: 0.68 };
    };
    let accent = readAccent();

    function build() {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Big glyphs => fewer, wider-spaced columns => less visual noise
      fontSize = Math.max(26, Math.round(W / 55));
      cols = Math.ceil(W / fontSize);
      drops = Array.from({ length: cols }, () => Math.random() * -H);
      speeds = Array.from({ length: cols }, () => 0.55 + Math.random() * 0.9);
      trails = Array.from({ length: cols }, () => []);
    }
    build();
    window.addEventListener('resize', build);

    const obs = new MutationObserver(() => {
      accent = readAccent();
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style'] });

    let last = performance.now();
    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      // Trail veil. This has to be strong enough that each glyph is erased well
      // before the next one lands in the same cell - too weak and the column
      // smears into a continuous band instead of reading as discrete glyphs.
      ctx.fillStyle = 'rgba(5, 5, 8, 0.22)';
      ctx.fillRect(0, 0, W, H);

      const step = Math.min(3.2, dt * 22);
      for (let i = 0; i < cols; i++) {
        drops[i] += step * speeds[i];
        if (drops[i] * fontSize > H && Math.random() > 0.975) {
          drops[i] = Math.random() * -20;
          trails[i] = [];
        }
        const y = drops[i] * fontSize;
        const x = i * fontSize;

        // head glyph
        const ch = GLYPHS[(Math.random() * GLYPHS.length) | 0];
        ctx.font = `${fontSize}px "JetBrainsMono Nerd Font", ui-monospace, monospace`;
        ctx.textBaseline = 'top';
        if (accent.h !== undefined) {
          ctx.fillStyle = `hsla(${accent.h}, ${accent.s * 100}%, ${Math.min(88, accent.l * 100 + 14)}%, 0.34)`;
        } else {
          ctx.fillStyle = `rgba(${accent.r}, ${accent.g}, ${accent.b}, 0.5)`;
        }
        ctx.fillText(ch, x, y);

        // tail glyphs, dimmer and dimmer
        const tail = trails[i];
        tail.unshift({ ch, life: 1 });
        if (tail.length > 14) tail.length = 14;
        for (let j = 1; j < tail.length; j++) {
          const t = tail[j];
          t.life -= dt * 1.5;
          const a = Math.max(0, t.life) * 0.085 * (1 - j / tail.length);
          if (a <= 0.004) continue;
          ctx.fillStyle =
            accent.h !== undefined
              ? `hsla(${accent.h}, ${accent.s * 100}%, ${accent.l * 100}%, ${a})`
              : `rgba(${accent.r}, ${accent.g}, ${accent.b}, ${a})`;
          ctx.fillText(t.ch, x, y - j * fontSize);
        }
      }
    }
    raf = requestAnimationFrame(frame);

    onCleanup(() => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', build);
      obs.disconnect();
    });
  });

  return (
    <canvas
      ref={canvas}
      class="fixed inset-0 pointer-events-none"
      style={{ 'z-index': '0', opacity: '0.32' }}
      aria-hidden="true"
    />
  );
}