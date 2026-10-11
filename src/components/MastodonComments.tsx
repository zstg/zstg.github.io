import { createSignal, onMount, Show } from 'solid-js';

interface Props {
  slug: string;
}

export default function MastodonComments(props: Props) {
  const [loaded, setLoaded] = createSignal(false);
  const [error, setError] = createSignal(false);

  const instance = 'fedia.social';
  const user = 'zstg';

  onMount(() => {
    try {
      const script = document.createElement('script');
      script.src = 'https://framasoft.org/mastodon-comments/mastodon-comments.js';
      script.onload = () => setLoaded(true);
      script.onerror = () => setError(true);
      document.head.appendChild(script);
    } catch {
      setError(true);
    }
  });

  return (
    <div class="mt-4">
      <h3 class="text-light font-semibold text-lg mb-4">Comments</h3>
      <Show when={!error()} fallback={
        <p class="text-muted text-sm">
          <a href={`https://${instance}/${user}`} class="text-accent hover:underline" rel="me">
            Follow me on Mastodon
          </a> to join the conversation.
        </p>
      }>
        <div
          class="mastodon-comments"
          data-server={instance}
          data-user={user}
          data-id={props.slug}
        >
          <Show when={!loaded()}>
            <p class="text-muted text-sm">Loading comments...</p>
          </Show>
        </div>
      </Show>
    </div>
  );
}
