/*
 * Fediverse identity.
 *
 * Every Mastodon reference on the site used to be a hardcoded string, which is
 * how the dock link and the comments section drift apart when one gets edited.
 * They all read it from here instead.
 *
 * Comments work per post: a post links its announcement toot with `toot: <url>`
 * in frontmatter, and MastodonComments derives the instance and status id from
 * that URL. Nothing here needs changing to add comments to a post - it is the
 * fallback identity the UI points at when no thread is linked yet.
 */

export interface FediverseConfig {
  /** Mastodon instance, no trailing slash. */
  instance: string;
  /** Your handle on that instance, without the leading @. */
  handle: string;
  /** Shown in the comments section when a post has no linked thread. */
  blurb: string;
}

export const FEDIVERSE: FediverseConfig = {
  instance: 'https://fedia.social',
  handle: 'zstg',
  blurb:
    'Comments live on the Fediverse. Link a post to its announcement toot with ' +
    '`toot: <url>` in the frontmatter and the reply thread appears here.',
};

/** Profile URL, e.g. https://fedia.social/@zstg */
export const fediverseProfileUrl = (): string => `${FEDIVERSE.instance}/@${FEDIVERSE.handle}`;

/** Display handle, e.g. @zstg */
export const fediverseHandle = (): string => `@${FEDIVERSE.handle}`;

/** Instance hostname, e.g. fedia.social */
export const fediverseInstance = (): string => {
  try {
    return new URL(FEDIVERSE.instance).hostname;
  } catch {
    return FEDIVERSE.instance;
  }
};