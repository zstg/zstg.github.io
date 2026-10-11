---
title: "Building with Org-mode"
date: 2026-07-26
tags: ["emacs", "workflow"]
series: "writing workflow"
lang: "en"
---

I write most of my notes and long-form text in Org-mode. For this blog, I convert `.org` files to Markdown using Pandoc before Astro processes them.

## The workflow

1. Write in `.org`
2. Run `./scripts/org2md.sh input.org > src/content/blog/output.md`
3. Astro picks it up from the content collection

It's a simple two-step process that keeps the editing experience I love while using a web-native format for the site.
