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

  onMount(() => {
    const ctx = canvas.getContext('2d')!;
    let particles: Snowflake[] = [];
    const COUNT = 90;

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
        ctx.fillStyle = `rgba(118, 159, 240, ${p.opacity})`;
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

    onCleanup(() => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
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
