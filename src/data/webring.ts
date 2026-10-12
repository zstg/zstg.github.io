/**
 * Webring members.
 *
 * Edit this list to change who appears in the dock. `initials` is what shows
 * inside the small circular tile - keep it to one or two characters.
 *
 * A webring is normally a ring of links with "previous / random / next"
 * navigation. Here the prev/next paging through your own posts lives in the
 * dock too (see DockPager.astro), and the random link picks a member from
 * this file.
 */
export interface WebringMember {
  name: string;
  url: string;
  initials: string;
}

export const WEBRING: WebringMember[] = [
  { name: 'Friend site one', url: 'https://example.com', initials: '1' },
  { name: 'Friend site two', url: 'https://example.org', initials: '2' },
  { name: 'Friend site three', url: 'https://example.net', initials: '3' },
];