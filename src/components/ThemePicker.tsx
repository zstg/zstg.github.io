import { createSignal, onMount, onCleanup, Show, For } from 'solid-js';
import { THEMES, loadStoredTheme, applyTheme } from '../data/themes';

const SPECTRUM =
  'linear-gradient(to right, hsl(0 85% 60%), hsl(60 85% 60%), hsl(120 85% 60%), hsl(180 85% 60%), hsl(240 85% 60%), hsl(300 85% 60%), hsl(360 85% 60%))';

export default function ThemePicker() {
  const [open, setOpen] = createSignal(false);
  const [current, setCurrent] = createSignal('midnight');
  const [hue, setHue] = createSignal(222);
  let root!: HTMLDivElement;
  let toggleBtn!: HTMLButtonElement;
  let strip!: HTMLDivElement;

  function select(id: string, customAccent?: string) {
    applyTheme(id, customAccent);
    setCurrent(id === 'custom' ? 'custom' : id);
    setOpen(false);
    toggleBtn?.focus();
  }

  function applyHue(h: number) {
    const hueNorm = ((Math.round(h) % 360) + 360) % 360;
    setHue(hueNorm);
    applyTheme('custom', `hsl(${hueNorm} 75% 68%)`);
    setCurrent('custom');
  }

  function hueFromEvent(e: PointerEvent): number {
    const r = strip.getBoundingClientRect();
    const x = Math.min(Math.max(e.clientX - r.left, 0), r.width);
    return (x / r.width) * 360;
  }

  function onStripPointer(e: PointerEvent & { currentTarget: HTMLDivElement }) {
    e.currentTarget.setPointerCapture(e.pointerId);
    applyHue(hueFromEvent(e));
    const move = (ev: PointerEvent) => applyHue(hueFromEvent(ev));
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function onSelect(e: Event & { currentTarget: HTMLSelectElement }) {
    const id = e.currentTarget.value;
    if (id === 'custom') {
      applyHue(hue());
    } else {
      select(id);
    }
  }

  onMount(() => {
    const stored = loadStoredTheme();
    setCurrent(stored.theme);
    if (stored.customAccent) {
      const m = stored.customAccent.match(/hsl\((\d+)/);
      if (m) setHue(Number(m[1]));
    }
    function onDocClick(e: MouseEvent) {
      if (root && !root.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        toggleBtn?.focus();
      }
    }
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
    onCleanup(() => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
    });
  });

  const activeAccent = () => {
    if (current() === 'custom') return `hsl(${hue()} 75% 68%)`;
    return THEMES.find((t) => t.id === current())?.vars.accent ?? '#769ff0';
  };

  return (
    <div ref={root} class="relative">
      <button
        ref={toggleBtn}
        type="button"
        onClick={() => setOpen(!open())}
        title="Theme"
        aria-label="Pick a theme"
        aria-expanded={open()}
        aria-haspopup="listbox"
        class="w-7 h-7 rounded-full border border-white/15 transition-transform hover:scale-110"
        style={{ background: activeAccent() }}
      />
      <Show when={open()}>
        <div class="absolute right-0 top-9 w-60 rounded-2xl border border-white/10 bg-dark-light p-4 shadow-2xl z-50">
          <label for="wob-theme-select" class="block text-xs text-muted mb-2">
            Theme
          </label>
          <select
            id="wob-theme-select"
            value={current()}
            onChange={onSelect}
            class="w-full rounded-lg border border-white/10 bg-dark px-2 py-1.5 text-sm text-light outline-none focus:border-accent"
          >
            <For each={THEMES}>{(t) => <option value={t.id}>{t.name}</option>}</For>
            <option value="custom">Custom…</option>
          </select>
          <Show when={current() === 'custom'}>
            <p class="text-xs text-muted mt-3 mb-2">Custom accent — click or drag</p>
            <div
              ref={strip}
              role="slider"
              tabindex="0"
              aria-label="Custom accent hue"
              aria-valuemin="0"
              aria-valuemax="360"
              aria-valuenow={hue()}
              onPointerDown={onStripPointer}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') applyHue(hue() - 5);
                else if (e.key === 'ArrowRight') applyHue(hue() + 5);
                else return;
                e.preventDefault();
              }}
              class="relative w-full h-3 rounded-full cursor-crosshair outline-none focus:ring-2 focus:ring-[var(--color-light)]"
              style={{ background: SPECTRUM }}
            >
              <div
                class="absolute top-1/2 w-4 h-4 rounded-full border-2 border-white shadow pointer-events-none"
                style={{
                  left: `calc(${(hue() / 360) * 100}% - 0.5rem)`,
                  transform: 'translateY(-50%)',
                  background: `hsl(${hue()} 75% 68%)`,
                }}
              />
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}
