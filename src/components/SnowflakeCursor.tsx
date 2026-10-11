import { createSignal, onMount, onCleanup } from 'solid-js';

export default function SnowflakeCursor() {
  const [pos, setPos] = createSignal({ x: -100, y: -100 });
  const [visible, setVisible] = createSignal(false);
  let targetX = -100;
  let targetY = -100;
  let currentX = -100;
  let currentY = -100;
  let animId: number;

  function lerp(a: number, b: number, t: number) {
    return a + (b - a) * t;
  }

  onMount(() => {
    function onMouseMove(e: MouseEvent) {
      targetX = e.clientX;
      targetY = e.clientY;
      if (!visible()) setVisible(true);
    }

    function onMouseLeave() {
      setVisible(false);
    }

    function animate() {
      currentX = lerp(currentX, targetX, 0.15);
      currentY = lerp(currentY, targetY, 0.15);
      setPos({ x: currentX, y: currentY });
      animId = requestAnimationFrame(animate);
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseleave', onMouseLeave);
    animate();

    onCleanup(() => {
      cancelAnimationFrame(animId);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseleave', onMouseLeave);
    });
  });

  return (
    <div
      class="fixed pointer-events-none select-none transition-opacity duration-300"
      style={{
        left: `${pos().x}px`,
        top: `${pos().y}px`,
        transform: 'translate(-50%, -50%)',
        'z-index': '9999',
        opacity: visible() ? 0.8 : 0,
        'font-size': '18px',
        color: 'var(--color-accent)',
        filter: 'drop-shadow(0 0 4px var(--color-accent))',
      }}
    >
      ❄
    </div>
  );
}
