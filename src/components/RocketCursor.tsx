import { onMount, onCleanup } from 'solid-js';

/*
 * Rocket cursor.
 *
 * A rocket sprite that banks into the direction of travel, trailing a fire
 * plume: short-lived particles emitted from the tail, cooling from white-hot
 * through yellow/orange to a dark red smoke before dying.
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

    function onMove(e: PointerEvent) {
      tx = e.clientX;
      ty = e.clientY;
      visible = true;
    }
    function onLeave() {
      visible = false;
    }
    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);

    // Rocket geometry, drawn pointing "up" (nose at -1) in local space.
    // `s` scales the whole sprite (body + exhaust cone) from one knob.
    function drawRocket() {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      const s = SIZE;

      // fins
      ctx.fillStyle = 'rgba(118,159,240,0.95)';
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
      trail.unshift({ x: cx, y: cy });
      if (trail.length > TRAIL_MAX) trail.length = TRAIL_MAX;

      if (trail.length > 2 && visible) {
        // three passes: wide+dim halo, then two tighter brighter cores
        const passes = [
          { w: 7 * SIZE, a: 0.1 },
          { w: 3 * SIZE, a: 0.28 },
          { w: 1.2 * SIZE, a: 0.6 },
        ];
        for (const { w, a } of passes) {
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          for (let i = 0; i < trail.length; i++) {
            const k = 1 - i / trail.length; // newest = 1
            const pt = trail[i];
            // taper the stroke by drawing short segments with varying alpha
            if (i === 0) ctx.moveTo(pt.x, pt.y);
            else {
              ctx.strokeStyle = `rgba(140, 170, 235, ${a * k * k})`;
              ctx.lineWidth = w * (0.35 + k * 0.65);
              ctx.beginPath();
              ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
              ctx.lineTo(pt.x, pt.y);
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(pt.x, pt.y);
            }
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