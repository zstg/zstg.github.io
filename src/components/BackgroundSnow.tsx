import { onMount, onCleanup } from 'solid-js';

interface Snowflake {
  x: number;
  y: number;
  radius: number;
  speed: number;
  opacity: number;
  wobble: number;
  wobbleSpeed: number;
  wobblePhase: number;
  wind: number;
}

export default function BackgroundSnow() {
  let canvas!: HTMLCanvasElement;
  let animId: number;
  let snowRGB = '118, 159, 240';

  function readAccent() {
    const v = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-accent')
      .trim();
    // #rrggbb | #rgb | hsl(...) | color-mix(...) fallback
    let m = v.match(/^#([0-9a-f]{6})$/i);
    if (m) {
      const n = parseInt(m[1], 16);
      snowRGB = `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
      return;
    }
    m = v.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
    if (m) {
      snowRGB = `${parseInt(m[1] + m[1], 16)}, ${parseInt(m[2] + m[2], 16)}, ${parseInt(m[3] + m[3], 16)}`;
      return;
    }
    m = v.match(/hsl\(\s*([\d.]+)[\s,]+([\d.]+)%[\s,]+([\d.]+)%/i);
    if (m) {
      const h = Number(m[1]) / 360, s = Number(m[2]) / 100, l = Number(m[3]) / 100;
      const f = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      let r: number, g: number, b: number;
      if (s === 0) {
        r = g = b = l;
      } else {
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = f(p, q, h + 1 / 3); g = f(p, q, h); b = f(p, q, h - 1 / 3);
      }
      snowRGB = `${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}`;
    }
  }

  onMount(() => {
    const ctx = canvas.getContext('2d')!;
    let particles: Snowflake[] = [];
    const COUNT = 90;
    readAccent();

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    function createSnowflake(startFromTop = false): Snowflake {
      return {
        x: Math.random() * canvas.width,
        y: startFromTop ? -10 : Math.random() * canvas.height,
        radius: 1 + Math.random() * 2.5,
        speed: 0.3 + Math.random() * 1.2,
        opacity: 0.08 + Math.random() * 0.25,
        wobble: 15 + Math.random() * 30,
        wobbleSpeed: 0.005 + Math.random() * 0.015,
        wobblePhase: Math.random() * Math.PI * 2,
        wind: -0.15 - Math.random() * 0.2,
      };
    }

    for (let i = 0; i < COUNT; i++) {
      particles.push(createSnowflake());
    }

    let time = 0;

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      time += 1;

      for (const p of particles) {
        const wobbleX = Math.sin(time * p.wobbleSpeed + p.wobblePhase) * p.wobble;

        ctx.beginPath();
        ctx.arc(p.x + wobbleX, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${snowRGB}, ${p.opacity})`;
        ctx.fill();

        p.y += p.speed;
        p.x += p.wind;

        if (p.y > canvas.height + 10) {
          Object.assign(p, createSnowflake(true));
        }
      }
      animId = requestAnimationFrame(draw);
    }
    draw();

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'attributes' && (m.attributeName === 'data-theme' || m.attributeName === 'style')) {
          readAccent();
        }
      }
    });
    observer.observe(document.documentElement, { attributes: true });

    onCleanup(() => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      observer.disconnect();
    });
  });

  return (
    <canvas
      ref={canvas}
      class="fixed inset-0 pointer-events-none"
      style={{ 'z-index': '0' }}
    />
  );
}
