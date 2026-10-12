import { createSignal, createEffect, onMount, onCleanup, Show, For } from 'solid-js';
import { THEMES, loadStoredTheme, applyTheme, parseColor, toCss } from '../data/themes';
import { syncM3Scheme } from '../lib/m3-scheme';
import { BACKGROUNDS, loadBackground, saveBackground } from '../data/backgrounds';

const SPECTRUM =
  'linear-gradient(to right, hsl(0 85% 60%), hsl(60 85% 60%), hsl(120 85% 60%), hsl(180 85% 60%), hsl(240 85% 60%), hsl(300 85% 60%), hsl(360 85% 60%))';

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/blog', label: 'Blog' },
  { href: '/about', label: 'About' },
  { href: '/resume', label: 'Resume' },
];

function labelFor(path: string): string {
  if (path === '/' || path === '') return 'Home';
  const hit = NAV.find((n) => n.href !== '/' && path.startsWith(n.href));
  return hit ? hit.label : 'Home';
}

function isActive(path: string, href: string): boolean {
  return path === href || (href !== '/' && path.startsWith(href));
}

export default function DynamicIsland(props: { currentPath: string }) {
  const [open, setOpen] = createSignal(false);
  const [pinned, setPinned] = createSignal(false);
  const [current, setCurrent] = createSignal('matrix');
  const [hue, setHue] = createSignal(222);
  const [rgbaText, setRgbaText] = createSignal('#75eb70');
  const [rgbaValid, setRgbaValid] = createSignal(true);
  const [background, setBackground] = createSignal(loadBackground());

  let root!: HTMLDivElement;
  let islandEl!: HTMLDivElement;
  let panelEl!: HTMLDivElement;
  let toggleBtn!: HTMLButtonElement;
  let strip!: HTMLDivElement;
  let closedW = 0;
  let openW = 0;
  let closeTimer: number | undefined;
  const canHover = () =>
    typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  function clearTimer() {
    if (closeTimer !== undefined) {
      window.clearTimeout(closeTimer);
      closeTimer = undefined;
    }
  }

  function show() {
    clearTimer();
    setOpen(true);
  }

  function hide() {
    clearTimer();
    setOpen(false);
  }

  function collapseSoon() {
    clearTimer();
    closeTimer = window.setTimeout(() => {
      if (!pinned()) setOpen(false);
    }, 140);
  }

  /** Push a colour (any supported format) into the live theme. */
  function commitColor(raw: string) {
    const parsed = parseColor(raw);
    if (!parsed) {
      setRgbaValid(false);
      return false;
    }
    const css = toCss(parsed);
    applyTheme('custom', css);
    setRgbaText(css);
    setRgbaValid(true);
    setHue(parsed.h);
    setCurrent('custom');
    return true;
  }

  function onRgbaInput(e: InputEvent & { currentTarget: HTMLInputElement }) {
    const v = e.currentTarget.value;
    setRgbaText(v);
    commitColor(v);
  }

  function onSelect(e: Event & { currentTarget: HTMLSelectElement }) {
    const id = e.currentTarget.value;
    if (id === 'custom') {
      if (!commitColor(rgbaText())) commitColor(`hsla(${hue()}, 75%, 68%, 1)`);
      show();
      return;
    }
    applyTheme(id);
    setCurrent(id);
  }

  function onBackgroundSelect(e: Event & { currentTarget: HTMLSelectElement }) {
    const id = e.currentTarget.value;
    saveBackground(id); // persists + broadcasts, so the effect swaps in place
    setBackground(id);
  }

  function hueFromEvent(e: PointerEvent): number {
    const r = strip.getBoundingClientRect();
    const x = Math.min(Math.max(e.clientX - r.left, 0), r.width);
    return (x / r.width) * 360;
  }

  function onStripPointer(e: PointerEvent & { currentTarget: HTMLDivElement }) {
    e.currentTarget.setPointerCapture(e.pointerId);
    commitColor(`hsla(${hueFromEvent(e)}, 75%, 68%, 1)`);
    const move = (ev: PointerEvent) => commitColor(`hsla(${hueFromEvent(ev)}, 75%, 68%, 1)`);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  onMount(() => {
    const stored = loadStoredTheme();
    setCurrent(stored.theme);
    if (stored.customAccent) {
      setRgbaText(stored.customAccent);
      const parsed = parseColor(stored.customAccent);
      if (parsed) setHue(parsed.h);
    } else if (stored.theme === 'custom') {
      commitColor(`hsla(${hue()}, 75%, 68%, 1)`);
    }
    // Preset themes already have their M3 palette in CSS. A custom accent has
    // no stylesheet entry, so generate its roles from the seed here.
    syncM3Scheme();

    function onDocClick(e: MouseEvent) {
      if (root && !root.contains(e.target as Node)) {
        setPinned(false);
        hide();
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setPinned(false);
        hide();
        toggleBtn?.focus();
      }
    }
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
    // The island's natural width depends on the font and the viewport, so
    // re-measure rather than trusting a width captured at mount.
    window.addEventListener('resize', measure);
    measure();
    onCleanup(() => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', measure);
      clearTimer();
    });
  });

  const alpha = () => {
    const p = parseColor(rgbaText());
    return p ? p.a : 1;
  };

  /*
   * Horizontal expansion.
   *
   * The panel used to carry a fixed width, which pinned the container to that
   * width whether it was open or not - so it could only ever unfold
   * vertically, like a scroll. Now the panel sizes itself (`island-inner` is
   * `width: max-content`) and we measure the two natural widths: the pill on
   * its own, and the pill plus its full panel. The container animates between
   * them, so it grows in both axes and refits itself whenever the content
   * changes (nav wraps, a custom-colour field appears, the viewport resizes).
   */
  function applyWidth() {
    if (!islandEl || !closedW || !openW) return;
    islandEl.style.width = `${open() ? openW : closedW}px`;
  }

  function measure() {
    if (!islandEl || !panelEl) return;
    const prevTransition = islandEl.style.transition;
    const prevWidth = islandEl.style.width;
    // Measure at the content's natural width, with transitions off so the
    // reads are the real values rather than mid-animation ones.
    islandEl.style.transition = 'none';
    islandEl.style.width = 'max-content';
    panelEl.style.display = 'none';
    closedW = islandEl.offsetWidth;
    panelEl.style.display = '';
    openW = islandEl.offsetWidth;
    islandEl.style.transition = prevTransition;
    islandEl.style.width = prevWidth;
    applyWidth();
  }

  createEffect(() => {
    // re-run whenever the island opens, so a resize lands on the right width
    open();
    if (!closedW || !openW) measure();
    else applyWidth();
  });

  return (
    <div ref={root} class="fixed top-4 left-1/2 -translate-x-1/2 z-50">
      <div
        ref={islandEl}
        class="island overflow-hidden"
        onPointerEnter={() => canHover() && show()}
        onPointerLeave={() => canHover() && collapseSoon()}
      >
        {/* condensed pill: always visible, defaults to shown */}
        <button
          ref={toggleBtn}
          type="button"
          onClick={() => {
            if (pinned()) {
              setPinned(false);
              hide();
            } else {
              setPinned(true);
              show();
            }
          }}
          aria-expanded={open()}
          aria-label={open() ? 'Collapse header' : 'Expand header'}
          data-open={open() ? 'true' : 'false'}
          class="m3-btn island-toggle font-medium transition-all duration-300 flex justify-center items-center gap-2 w-full"
        >
          <span class="whitespace-nowrap">{labelFor(props.currentPath)}</span>
          <svg
            class="w-3.5 h-3.5 transition-transform duration-300"
            style={{ transform: open() ? 'rotate(180deg)' : 'rotate(0deg)' }}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* expanded content */}
        <div
          ref={panelEl}
          class="grid island-panel transition-all duration-300 ease-out"
          style={{
            'grid-template-rows': open() ? '1fr' : '0fr',
            opacity: open() ? 1 : 0,
          }}
        >
          <div class="overflow-hidden">
            <div class="island-inner px-3 pb-3">
              <nav aria-label="Main">
              <ul class="flex flex-wrap items-center gap-1.5">
                <For each={NAV}>
                  {({ href, label }) => (
                    <li>
                      <a
                        href={href}
                        aria-current={isActive(props.currentPath, href) ? 'page' : undefined}
                        class={
                          'm3-btn' + (isActive(props.currentPath, href) ? ' m3-btn--active' : '')
                        }
                      >
                        {label}
                      </a>
                    </li>
                  )}
                </For>
              </ul>
            </nav>

            <div class="mt-3 pt-3 border-t border-white/10">
              <label for="wob-theme-select" class="block text-xs text-muted mb-2">
                Theme
              </label>
              <select
                id="wob-theme-select"
                value={current()}
                onChange={onSelect}
                class="m3-select w-full text-sm"
              >
                <For each={THEMES}>{(t) => <option value={t.id}>{t.name}</option>}</For>
                <option value="custom">Custom…</option>
              </select>

              <label for="wob-bg-select" class="block text-xs text-muted mt-3 mb-2">
                Background
              </label>
              <select
                id="wob-bg-select"
                value={background()}
                onChange={onBackgroundSelect}
                class="m3-select w-full text-sm"
              >
                <For each={BACKGROUNDS}>{(b) => <option value={b.id}>{b.name}</option>}</For>
              </select>
              <p class="text-xs text-muted mt-1.5">
                {BACKGROUNDS.find((b) => b.id === background())?.hint}
              </p>

              <Show when={current() === 'custom'}>
                <p class="text-xs text-muted mt-3 mb-2">Click or drag the spectrum</p>
                <div
                  ref={strip}
                  role="slider"
                  tabindex="0"
                  aria-label="Custom accent hue"
                  aria-valuemin="0"
                  aria-valuemax="360"
                  aria-valuenow={Math.round(hue())}
                  onPointerDown={onStripPointer}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowLeft') commitColor(`hsla(${hue() - 5}, 75%, 68%, ${alpha()})`);
                    else if (e.key === 'ArrowRight') commitColor(`hsla(${hue() + 5}, 75%, 68%, ${alpha()})`);
                    else return;
                    e.preventDefault();
                  }}
                  class="relative w-full h-3 rounded-full cursor-crosshair outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                  style={{ background: SPECTRUM }}
                >
                  <div
                    class="absolute top-1/2 w-4 h-4 rounded-full border-2 border-white shadow pointer-events-none"
                    style={{
                      left: `calc(${(hue() / 360) * 100}% - 0.5rem)`,
                      transform: 'translateY(-50%)',
                      background: `hsla(${hue()}, 75%, 68%, ${alpha()})`,
                    }}
                  />
                </div>

                <label for="wob-rgba" class="block text-xs text-muted mt-3 mb-1.5">
                  Colour (hex — 8 digits adds opacity)
                </label>
                <div class="flex items-center gap-2">
                  <span
                    class="w-8 h-8 shrink-0 rounded-xl border border-white/15"
                    style={{ background: 'var(--color-accent)' }}
                    aria-hidden="true"
                  />
                  <input
                    id="wob-rgba"
                    type="text"
                    value={rgbaText()}
                    onInput={onRgbaInput}
                    spellcheck={false}
                    aria-invalid={!rgbaValid()}
                    placeholder="#75eb70 or #75eb7000"
                    class="m3-input min-w-0 flex-1 text-sm"
                    style={{
                      'border-color': rgbaValid()
                        ? 'color-mix(in srgb, var(--color-accent) 35%, transparent)'
                        : '#e05561',
                    }}
                  />
                </div>
                <Show when={!rgbaValid()}>
                  <p class="text-xs mt-1.5" style={{ color: '#e05561' }}>
                    Unrecognised colour — try #rrggbb, #rrggbbaa, rgb()/rgba() or hsl()/hsla().
                  </p>
                </Show>
              </Show>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}