---
title: "Notes on Building a Personal Site That Lasts"
date: 2026-10-11
tags: ["web", "astro", "design", "notes"]
series: "writing workflow"
lang: "en"
---

Every personal site begins the same way: a burst of enthusiasm, a weekend of
naming decisions, and a deploy that feels like an ending. Then the slow part
happens. The site sits there for a year, quietly accruing the small frictions
that you stop noticing but never stop paying for.

This is a working set of notes on the decisions that survived that year — the
ones that turned out to matter, and the ones I would undo.

## The stack

The site is Astro with SolidJS islands and Tailwind. That combination is not
a fashion statement; it is a specific set of trade-offs that I wanted.

Astro's default is to ship zero JavaScript. That is the property I care about
most, because a personal site is, among other things, a thing that should keep
working when you are on a train with no signal. Every island I add is a small
tax on that promise, so the bar for adding one is genuinely high.

Solid is used only where interaction genuinely requires it: the theme picker,
the cursor, the particle field. These are components whose entire reason to
exist is state that changes in the browser. Rendering them server-side and then
waking them up would be more code for the same result.

Tailwind is less exciting and enormously useful. The value is not any
individual utility — it is that the design tokens live in one place, which is
what made the theming system possible.

## Theming is a data problem, not a CSS problem

The first version of this site had one accent colour, written into the
stylesheet. The moment I wanted a second theme, I discovered that hardcoded
colours are the real enemy, not the lack of themes.

The working model turned out to be small and boring:

1. Every colour is a CSS custom property.
2. Presets are data — a list of theme objects with a fixed shape.
3. A single `data-theme` attribute on the root selects a preset block.
4. Custom colours override two variables and nothing else.

Point three is the load-bearing one. Because the preset is expressed as CSS
that sets variables rather than as classes sprinkled across components, adding
a theme means adding one block of CSS and one object. No component changes. I
have added themes since without touching a component file, which is exactly
the property I wanted from the design.

The subtle trap is custom accents with alpha. If the user can pick a
translucent colour, every derived value has to know about it. Buttons, glows,
text contrast — all of them need the alpha composited against the background
before they can decide what colour text to put on top. I got this wrong twice
before it occurred to me that a translucent accent is not simply an opaque
accent that happens to be see-through.

## Motion should be legible, not impressive

There is a version of this site with a lot more animation, and it was worse.

The rule I settled on: motion exists to explain a spatial relationship, not to
entertain. When the projects section fades out as the about section rises,
that is explaining where you are. When something spins because it spins, that
is decoration, and decoration competes with text for attention.

The particle field is technically decoration, and I kept it because it earns
its place by being slow, dim, and behind everything. It never competes. The
moment it started competing, it was wrong.

Smoothness matters more than quantity here. A 200 ms transition on something
that fires every 16 ms is worse than no transition, because the rendered value
constantly lags the target and the result reads as jitter. This is not a
subtle point. It cost me an afternoon to find, because the bug only appeared at
the very bottom of a very long page.

## Things I would do differently

**Start with the reading progress.** Every long article needs to know where the
reader is. I built it last, and it should have been first.

**Write the content, not the chrome.** The design system consumed most of the
build time and the posts consumed almost none. A site with three posts and a
perfect theme system is still empty.

**Hide the scrollbar deliberately.** Default scrollbars are chrome. Replacing
the vertical one with a thin horizontal indicator is not only an aesthetic
choice — it reclaims vertical space, and it gives the reader a continuous sense
of position that a segmented rail provides more legibly than a thumb.

## Ongoing

There is an Org-mode pipeline that I will write up separately, because it is
interesting in its own right: source files in one format, converted to
Markdown at build time, so the writing environment stays Emacs-native while
the published site stays web-native. The piece I am still figuring out is
whether conversion should happen at build time or at request time, and the
answer depends almost entirely on how much I care about build speed once the
archive gets large.