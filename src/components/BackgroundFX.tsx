import { createSignal, onMount, onCleanup, Switch, Match } from 'solid-js';
import MatrixRain from './MatrixRain';
import DotMatrix from './fx/DotMatrix';
import Honeycomb from './fx/Honeycomb';
import CircuitTrace from './fx/CircuitTrace';
import ContourLines from './fx/ContourLines';
import MeshGradient from './fx/MeshGradient';
import { loadBackground, BG_CHANGE_EVENT, DEFAULT_BACKGROUND } from '../data/backgrounds';

/**
 * Hosts the active background effect.
 *
 * One effect is mounted at a time; swapping unmounts the old canvas and its
 * rAF subscription, so the cost stays flat no matter how many effects exist.
 * They all share a single animation loop (see lib/fx-ticker).
 *
 * The signal starts at DEFAULT_BACKGROUND rather than the stored value on
 * purpose: this component is server-rendered, and localStorage does not exist
 * there, so reading it during the initial render would make the server emit
 * the default while the client immediately emitted the stored effect. Solid
 * then fails to hydrate against mismatched markup and the canvas is never
 * sized. Reading storage in onMount keeps server and client identical.
 */
export default function BackgroundFX() {
  const [id, setId] = createSignal(DEFAULT_BACKGROUND);

  onMount(() => {
    setId(loadBackground());
    const onChange = () => setId(loadBackground());
    window.addEventListener(BG_CHANGE_EVENT, onChange);
    onCleanup(() => window.removeEventListener(BG_CHANGE_EVENT, onChange));
  });

  return (
    <Switch>
      <Match when={id() === 'matrix'}>
        <MatrixRain />
      </Match>
      <Match when={id() === 'dots'}>
        <DotMatrix />
      </Match>
      <Match when={id() === 'honeycomb'}>
        <Honeycomb />
      </Match>
      <Match when={id() === 'circuit'}>
        <CircuitTrace />
      </Match>
      <Match when={id() === 'contour'}>
        <ContourLines />
      </Match>
      <Match when={id() === 'mesh'}>
        <MeshGradient />
      </Match>
    </Switch>
  );
}