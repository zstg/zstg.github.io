/*
 * Theme and background ownership for the lifetime of the document.
 *
 * The page needs two things to be true at all times, and the ClientRouter is
 * hostile to both:
 *
 *   1. <html> carries the theme (`data-theme`, plus inline custom-accent
 *      variables) before anything paints.
 *   2. The chosen background effect is the one that is mounted.
 *
 * Astro's swap calls swapRootAttributes(), which strips *every* attribute off
 * the live <html> and copies the incoming document's instead - and that
 * document is server-rendered, so it has neither. Astro also will not re-run an
 * inline script it has already run unless the script asks for it. So whatever
 * the theme was, a client-side navigation threw it away, and the page came up
 * on the stylesheet defaults while the picker still showed the chosen theme.
 *
 * Three layers, deliberately:
 *
 *   - the inline pre-paint script in BaseLayout.astro restores the theme on the
 *     very first load, before anything is painted, with no module round-trip.
 *   - that script carries data-astro-rerun, so it also runs at the start of
 *     every swap - the earliest possible moment, and before the islands of the
 *     incoming page mount and read the accent.
 *   - this module is the backstop for the documented navigation events. It does
 *     not depend on script re-execution, on the shape of the inline script, or
 *     on the islands remounting; if either of the above ever stops working, the
 *     theme is re-asserted one step later in the same task, still before the
 *     browser paints.
 *
 * Re-applying is idempotent: the same theme writes the same attributes, the
 * same custom-accent variables and the same palette.
 */

import { applyTheme, loadStoredTheme } from '../data/themes';
import { BG_CHANGE_EVENT, loadBackground } from '../data/backgrounds';

/** The default is a real preset, so an unusable stored value still lands on it. */
const DEFAULT_THEME = 'matrix';

/**
 * Put the stored theme back on the document.
 *
 * `applyTheme` persists as it applies, which is fine here: it is re-writing the
 * value that is already stored. If the stored value is unusable (not a theme id
 * and not a custom accent) it reports failure, and the page is put on the
 * default rather than left to the stylesheet's idea of a fallback.
 */
export function restoreTheme(): void {
  const stored = loadStoredTheme();
  if (applyTheme(stored.theme, stored.customAccent)) return;
  applyTheme(DEFAULT_THEME);
}

/**
 * Re-announce the stored background.
 *
 * The effect host subscribes to this event and re-reads storage, so the swap
 * cannot leave a stale or missing canvas behind. A no-op when the island is
 * already showing the stored effect, which is the common case.
 */
export function restoreBackground(): void {
  window.dispatchEvent(new CustomEvent(BG_CHANGE_EVENT, { detail: loadBackground() }));
}

/** Idempotent: safe to call on every navigation, and on the first load. */
export function restorePreferences(): void {
  restoreTheme();
  restoreBackground();
}

restorePreferences();

// before-swap is dispatched immediately before swapRootAttributes runs, so this
// is the last chance to get the attributes onto <html> ahead of the wipe. The
// inline pre-paint script has normally already done it by now.
document.addEventListener('astro:before-swap', restoreTheme);

// after-swap is dispatched straight after the swap, in the same task as the
// DOM replacement and before the browser renders the new page.
document.addEventListener('astro:after-swap', restorePreferences);