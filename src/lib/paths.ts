/**
 * Where blog content lives.
 *
 * One definition, imported by the content collection and by the Org-to-Markdown
 * integration, so the two cannot disagree about what counts as a post.
 *
 * To move the blog - into `src/posts`, or somewhere outside `src/content` -
 * change this string. Nothing else needs to know: URLs come from each file's own
 * name, so posts keep their addresses wherever the tree moves.
 *
 * Sub-directories still work and are the right place to group a post with its
 * images, so `Linux/NixOS/nixos-part-1/index.org` can sit next to its `nixos.png`.
 * The URL stays flat because of src/lib/slug.ts.
 */
export const BLOG_DIR = 'src/content';
