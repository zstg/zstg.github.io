import { createSignal, onMount, onCleanup } from 'solid-js';

/*
 * Reading progress rail.
 *
 * A fine grid of cells across the top of the viewport. Cells fill with the
 * accent colour as you scroll down and empty again as you scroll back up,
 * giving a "hackerman"-ish readout of how far through the page you are.
 */
export default function ReadProgress(props: { cells?: number }) {
  const [filled, setFilled] = createSignal(0);
  let ticking = false;
  let rail!: HTMLDivElement;
  let idleTimer: number | undefined;

  onMount(() => {
    const N = props.cells ?? 64;
    function measure() {
      const doc = document.documentElement;
      const max = Math.max(1, doc.scrollHeight - window.innerHeight);
      const t = Math.min(1, Math.max(0, window.scrollY / max));
      setFilled(Math.round(t * N));
    }
    /*
     * The rail is only visible while the page is being scrolled - it fades
     * in on movement and back out once scrolling stops, so it never sits on
     * the page as permanent chrome.
     */
    function markScrolling() {
      rail.classList.add('is-scrolling');
      if (idleTimer !== undefined) window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        rail.classList.remove('is-scrolling');
      }, 900);
    }
    function onScroll() {
      markScrolling();
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        measure();
        ticking = false;
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    measure();
    onCleanup(() => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (idleTimer !== undefined) window.clearTimeout(idleTimer);
    });
  });

  const N = () => props.cells ?? 64;

  return (
    <div
      ref={rail}
      class="read-rail"
      role="progressbar"
      aria-label="Reading progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round((filled() / N()) * 100)}
    >
      {Array.from({ length: N() }, (_, i) => (
        <i class="read-cell" data-on={i < filled() ? 'true' : 'false'} />
      ))}
    </div>
  );
}