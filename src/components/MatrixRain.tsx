import { onMount, onCleanup } from 'solid-js';

/*
 * Matrix rain.
 *
 * Columns of falling glyphs drawn on a 2D canvas. Deliberately faint and
 * desaturated so it reads as texture rather than content: text on top of it
 * stays comfortably legible.
 */

/*
 * Glyph pool.
 *
 * Deliberately restricted to characters JetBrains Mono actually contains -
 * it has no katakana, so CJK glyphs rendered as tofu/blank in some themes
 * depending on what the system fell back to. Latin, Greek, Cyrillic, box
 * drawing and arrows are all covered by the webfont.
 */
const GLYPHS =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz' +
  'ΔΘΛΣΦΞΨΩαβγδπσφω' +
  'АБВГДЕЖЗИКЛМНОПРСТУ' +
  '─│┌┐└┘├┤┬┴┼═║╔╗╚╝' +
  '<>*+-=:/\\|[]{}()!?#$%&@^~';

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

    /*
     * Normalise --color-accent into one HSL + alpha shape.
     * Hex presets and hsla() customs used to take different code paths, which
     * is why the rain looked different under a custom theme (the hex branch
     * returned h:0, forcing every preset toward red).
     */
    const readAccent = () => {
      const v = getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim();
      const f = (u: number) => (u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4));
      let r = 118 / 255,
        g = 159 / 255,
        b = 240 / 255;
      let a = 1;

      const hex = v.match(/^#([0-9a-f]{3,8})$/i);
      if (hex) {
        let hx = hex[1];
        if (hx.length === 3 || hx.length === 4) {
          hx = hx
            .split('')
            .map((c) => c + c)
            .join('');
        }
        r = parseInt(hx.slice(0, 2), 16) / 255;
        g = parseInt(hx.slice(2, 4), 16) / 255;
        b = parseInt(hx.slice(4, 6), 16) / 255;
        if (hx.length === 8) a = parseInt(hx.slice(6, 8), 16) / 255;
      } else {
        const m = v.match(/hsla?\(([^)]+)\)/i);
        if (m) {
          const p = m[1].split(/[,/\s]+/).filter(Boolean).map(parseFloat);
          if (p.length >= 3) {
            const hh = p[0] / 360;
            const ss = p[1] / 100;
            const ll = p[2] / 100;
            const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
            const pp = 2 * ll - q;
            const fx = (t: number) => {
              if (t < 0) t += 1;
              if (t > 1) t -= 1;
              if (t < 1 / 6) return pp + (q - pp) * 6 * t;
              if (t < 1 / 2) return q;
              if (t < 2 / 3) return pp + (q - pp) * (2 / 3 - t) * 6;
              return pp;
            };
            r = fx(hh + 1 / 3);
            g = fx(hh);
            b = fx(hh - 1 / 3);
            if (p.length >= 4) a = p[3];
          }
        }
      }
      // rgb -> hsl
      const max = Math.max(r, g, b),
        min = Math.min(r, g, b);
      const l = (max + min) / 2;
      let h = 0;
      let s = 0;
      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        else if (max === g) h = ((b - r) / d + 2) / 6;
        else h = ((r - g) / d + 4) / 6;
      }
      void f;
      return { h: h * 360, s, l, a };
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
      speeds = Array.from({ length: cols }, () => 0.5 + Math.random() * 0.7);
      trails = Array.from({ length: cols }, () => []);
    }
    build();
    window.addEventListener('resize', build);

    const obs = new MutationObserver(() => {
      accent = readAccent();
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style'] });

    let last = performance.now();
    let frames = 0;
    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      // Trail veil. This has to be strong enough that each glyph is erased well
      // before the next one lands in the same cell - too weak and the column
      // smears into a continuous band instead of reading as discrete glyphs.
      ctx.fillStyle = 'rgba(5, 5, 8, 0.22)';
      ctx.fillRect(0, 0, W, H);

      // Periodic re-read in case the observer missed an accent change.
      if (++frames % 30 === 0) accent = readAccent();

      // Slow, calm fall. It is background texture, not a distraction.
      const step = Math.min(1.5, dt * 7);
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
        const { h, s, l, a: accA } = accent;
        ctx.fillStyle = `hsla(${h}, ${s * 100}%, ${Math.min(88, l * 100 + 14)}%, ${0.55 * accA})`;
        ctx.fillText(ch, x, y);

        // tail glyphs, dimmer and dimmer
        const tail = trails[i];
        tail.unshift({ ch, life: 1 });
        if (tail.length > 12) tail.length = 12;
        for (let j = 1; j < tail.length; j++) {
          const t = tail[j];
          t.life -= dt * 1.5;
          const ta = Math.max(0, t.life) * 0.16 * (1 - j / tail.length) * accA;
          if (ta <= 0.004) continue;
          ctx.fillStyle = `hsla(${h}, ${s * 100}%, ${l * 100}%, ${ta})`;
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
      style={{ 'z-index': '0', opacity: '0.5' }}
      aria-hidden="true"
    />
  );
}