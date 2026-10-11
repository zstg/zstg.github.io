import { onMount, onCleanup } from 'solid-js';

/*
 * Rocket cursor.
 *
 * A rocket sprite that banks into the direction of travel, trailing an
 * accent-coloured flame and a fading position ribbon. The nose tip is the
 * hotspot, so clicks register exactly where the pointer is.
 */

interface Pt {
  x: number;
  y: number;
}

export default function RocketCursor(props: { size?: number }) {
  let canvas!: HTMLCanvasElement;
  let raf = 0;

  onMount(() => {
    const ctx = canvas.getContext('2d')!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Overall rocket scale. Set `--rocket-size` in CSS (e.g. 2 for twice as
    // big) or pass <RocketCursor size={2} />; the prop wins.
    const cssSize = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--rocket-size')
    );
    const SIZE =
      props.size ?? (Number.isFinite(cssSize) && cssSize > 0 ? cssSize : 1);

    let W = 0;
    let H = 0;
    function resize() {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    // rocket state
    let tx = -100;
    let ty = -100;
    let cx = -100;
    let cy = -100;
    let angle = -Math.PI / 2; // facing up at rest
    let speed = 0;
    let visible = false;

    const trail: Pt[] = [];
    const TRAIL_MAX = 26;

    // Accent colour, so the plume re-themes with the rest of the site.
    const readAccent = (): [number, number, number] => {
      const v = getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim();
      let m = v.match(/^#([0-9a-f]{6})$/i);
      if (m) {
        const n = parseInt(m[1], 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      }
      m = v.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
      if (m) {
        return [
          parseInt(m[1] + m[1], 16),
          parseInt(m[2] + m[2], 16),
          parseInt(m[3] + m[3], 16),
        ];
      }
      m = v.match(/hsla?\(\s*([\d.]+)[\s,]+([\d.]+)%[\s,]+([\d.]+)%/i);
      if (m) {
        const h = Number(m[1]) / 360;
        const s = Number(m[2]) / 100;
        const l = Number(m[3]) / 100;
        const f = (p: number, q: number, t: number) => {
          if (t < 0) t += 1;
          if (t > 1) t -= 1;
          if (t < 1 / 6) return p + (q - p) * 6 * t;
          if (t < 1 / 2) return q;
          if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
          return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        return [
          Math.round(f(p, q, h + 1 / 3) * 255),
          Math.round(f(p, q, h) * 255),
          Math.round(f(p, q, h - 1 / 3) * 255),
        ];
      }
      return [118, 159, 240];
    };
    let flame = readAccent();
    const accentObs = new MutationObserver(() => {
      flame = readAccent();
    });
    accentObs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'style'],
    });

    // The nose tip is the hotspot: the sprite is drawn offset so its tip
    // lands exactly on the pointer, making clicks register where you aim.
    const NOSE_LEN = 11; // matches the body path's nose in local units

    function onMove(e: PointerEvent) {
      tx = e.clientX;
      ty = e.clientY;
      visible = true;
    }
    /*
     * A focused <select> opens a native popup that renders OUTSIDE the page,
     * which fires pointerleave. We would hide the rocket - and since the page
     * sets `cursor: none` globally, the user would be left with no cursor at
     * all. So while a select is focused we keep the rocket drawn (parked at
     * the select) instead of letting it disappear.
     */
    let selectFocus = false;
    function onLeave() {
      if (selectFocus) return;
      visible = false;
    }
    function onFocusIn(e: FocusEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'SELECT' || t.closest('select'))) {
        selectFocus = true;
        // park the rocket over the control so it doesn't vanish mid-click
        const r = t.getBoundingClientRect();
        tx = r.x + r.width / 2;
        ty = r.y + r.height / 2;
        cx = tx;
        cy = ty;
        visible = true;
      }
    }
    function onFocusOut(e: FocusEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'SELECT' || t.closest('select'))) {
        selectFocus = false;
      }
    }
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    window.addEventListener('focus', () => {
      // native popup closed and focus returned to the page
      selectFocus = false;
    });
    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);

    // Rocket geometry, drawn pointing "up" (nose at -1) in local space.
    // The sprite is translated so its NOSE TIP sits on the pointer.
    function drawRocket() {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.translate(0, NOSE_LEN * SIZE); // push body down so nose lands on cursor
      const s = SIZE;
      const [fr, fg, fb] = flame;

      // accent-tinted flame at the tail, scaled by thrust
      const thrust = Math.min(1, speed / 16);
      if (thrust > 0.04) {
        const flick = 0.72 + Math.random() * 0.4;
        const len = (7 + 10 * thrust) * flick * s;
        const g = ctx.createLinearGradient(0, 7 * s, 0, (7 * s + len));
        g.addColorStop(0, `rgba(255,255,255,0.9)`);
        g.addColorStop(0.3, `rgba(${fr},${fg},${fb},0.75)`);
        g.addColorStop(0.7, `rgba(${fr},${fg},${fb},0.3)`);
        g.addColorStop(1, `rgba(${fr},${fg},${fb},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-3.8 * s, 7 * s);
        ctx.quadraticCurveTo(-2 * s, (11 + len / s / 2) * s, 0, (7 * s + len));
        ctx.quadraticCurveTo(2 * s, (11 + len / s / 2) * s, 3.8 * s, 7 * s);
        ctx.closePath();
        ctx.fill();
      }

      // fins
      ctx.fillStyle = `rgba(${fr},${fg},${fb},0.95)`;
      ctx.beginPath();
      ctx.moveTo(-2.6 * s, 2 * s);
      ctx.lineTo(-6.4 * s, 8 * s);
      ctx.lineTo(-2.6 * s, 7 * s);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(2.6 * s, 2 * s);
      ctx.lineTo(6.4 * s, 8 * s);
      ctx.lineTo(2.6 * s, 7 * s);
      ctx.closePath();
      ctx.fill();

      // body
      const bg = ctx.createLinearGradient(-5 * s, 0, 5 * s, 0);
      bg.addColorStop(0, '#c9d4ee');
      bg.addColorStop(0.5, '#f2f5ff');
      bg.addColorStop(1, '#8ea2cc');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.moveTo(0, -11 * s);
      ctx.quadraticCurveTo(5.2 * s, -2 * s, 4.4 * s, 6 * s);
      ctx.lineTo(-4.4 * s, 6 * s);
      ctx.quadraticCurveTo(-5.2 * s, -2 * s, 0, -11 * s);
      ctx.closePath();
      ctx.fill();

      // window
      ctx.fillStyle = '#0b1020';
      ctx.beginPath();
      ctx.arc(0, -1.2 * s, 2.3 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(180,215,255,0.8)';
      ctx.beginPath();
      ctx.arc(-0.7 * s, -2 * s, 0.9 * s, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    let last = performance.now();
    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      ctx.clearRect(0, 0, W, H);
      if (!visible) return;

      // smooth follow
      const lerp = 1 - Math.pow(0.0008, dt);
      const px = cx;
      const py = cy;
      cx += (tx - cx) * lerp;
      cy += (ty - cy) * lerp;

      const vx = (cx - px) / Math.max(dt, 0.001);
      const vy = (cy - py) / Math.max(dt, 0.001);
      speed = Math.hypot(vx, vy);

      // bank into the direction of travel
      if (speed > 0.6) {
        const target = Math.atan2(vy, vx) + Math.PI / 2;
        let d = target - angle;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        angle += d * Math.min(1, dt * 12);
      }

      drawRocket();

      /*
       * Trail: a ribbon of recent positions drawn behind the rocket.
       * No sparks, no flame - just the path it flew through, fading out.
       */
      // record the TAIL position, not the pointer, so the ribbon emerges
      // from the engine rather than from under the nose
      const backX = -Math.sin(angle);
      const backY = Math.cos(angle);
      const tailX = cx + backX * (NOSE_LEN + 7) * SIZE;
      const tailY = cy + backY * (NOSE_LEN + 7) * SIZE;
      trail.unshift({ x: tailX, y: tailY });
      if (trail.length > TRAIL_MAX) trail.length = TRAIL_MAX;

      if (trail.length > 2 && visible) {
        const [tr, tg, tb] = flame;
        // three passes: wide+dim halo, then two tighter brighter cores
        const passes = [
          { w: 6 * SIZE, a: 0.12 },
          { w: 2.6 * SIZE, a: 0.3 },
          { w: 1.1 * SIZE, a: 0.62 },
        ];
        for (const { w, a } of passes) {
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          for (let i = 1; i < trail.length; i++) {
            const k = 1 - i / trail.length;
            const a2 = a * k * k;
            if (a2 <= 0.004) continue;
            ctx.strokeStyle = `rgba(${tr},${tg},${tb},${a2})`;
            ctx.lineWidth = w * (0.35 + k * 0.65);
            ctx.beginPath();
            ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
            ctx.lineTo(trail[i].x, trail[i].y);
            ctx.stroke();
          }
        }
      }
    }
    raf = requestAnimationFrame(frame);

    onCleanup(() => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      accentObs.disconnect();
    });
  });

  return (
    <canvas
      ref={canvas}
      class="fixed inset-0 pointer-events-none"
      style={{ 'z-index': '9999' }}
      aria-hidden="true"
    />
  );
}