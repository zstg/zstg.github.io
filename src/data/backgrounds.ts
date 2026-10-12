export interface BackgroundOption {
  id: string;
  name: string;
  /** Shown as a hint in the picker. */
  hint?: string;
}

/**
 * Ambient background effects. Exactly one is mounted at a time - they all
 * paint over the same area, and stacking several full-screen canvases reads as
 * noise rather than depth.
 *
 * The Matrix rain is the default so the site looks unchanged until you opt in.
 */
export const BACKGROUNDS: BackgroundOption[] = [
  { id: 'matrix', name: 'Matrix rain', hint: 'falling glyphs' },
  { id: 'dots', name: 'Dot matrix', hint: 'lights up behind the cursor' },
  { id: 'honeycomb', name: 'Honeycomb', hint: 'drifting hex lattice' },
  { id: 'circuit', name: 'Circuit tracing', hint: 'pulses along PCB traces' },
  { id: 'contour', name: 'Contour lines', hint: 'topographic bands' },
  { id: 'mesh', name: 'Mesh gradient', hint: 'slow colour bleed' },
  { id: 'none', name: 'None', hint: 'just the sphere' },
];

export const BG_STORAGE_KEY = 'wob-bg-v1';
export const BG_CHANGE_EVENT = 'wob:backgroundchange';
export const DEFAULT_BACKGROUND = 'matrix';

export function loadBackground(): string {
  try {
    const v = localStorage.getItem(BG_STORAGE_KEY);
    if (v && BACKGROUNDS.some((b) => b.id === v)) return v;
  } catch {
    /* private mode / quota */
  }
  return DEFAULT_BACKGROUND;
}

export function saveBackground(id: string): void {
  try {
    localStorage.setItem(BG_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
  // tell the mounted effect host to swap immediately, no reload
  window.dispatchEvent(new CustomEvent(BG_CHANGE_EVENT, { detail: id }));
}