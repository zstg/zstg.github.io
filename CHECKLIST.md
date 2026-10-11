# Implementation Checklist

## Phase 1: Typography & Basic Styling
- [ ] Change font to JetBrainsMono Nerd Font in global.css
- [ ] Update font import in BaseLayout.astro
- [ ] Add button base styles to global.css
- [ ] Add rounding tokens to global.css

## Phase 2: Component Styling Updates
- [ ] Update Header.astro — add rounding to nav
- [ ] Update Footer.astro — add rounding
- [ ] Update FediverseFollow.astro — button styling
- [ ] Update index.astro buttons — button styling
- [ ] Update about.astro links — button styling
- [ ] Update resume.astro download link — button styling
- [ ] Update blog/index.astro cards — rounding
- [ ] Update blog/[...slug].astro cards — rounding
- [ ] Update ParallaxProjects.tsx cards — rounding

## Phase 3: Background Animation
- [ ] Rename BackgroundRain.tsx to BackgroundSnow.tsx
- [ ] Rewrite particle system for snow (circles, slow fall, wobble)
- [ ] Update BaseLayout.astro to import BackgroundSnow
- [ ] Delete old BackgroundRain.tsx

## Phase 4: Custom Cursor
- [ ] Create SnowflakeCursor.tsx component
- [ ] Add cursor: none CSS to global.css
- [ ] Import SnowflakeCursor in BaseLayout.astro

## Phase 5: Penrose Triangle Fix
- [ ] Rewrite PenroseTriangle.tsx with proper geometry
- [ ] Use correct triangle vertices: (100,35), (40,155), (160,155)
- [ ] Implement proper beam parallelograms
- [ ] Add correct mask rectangles at each vertex
- [ ] Redraw "over" beam edges on top of masks
- [ ] Test rotation animation

## Phase 6: Parallax Scroll Fix
- [ ] Rewrite ParallaxProjects.tsx scroll calculation
- [ ] Use container.offsetTop for section-relative scroll
- [ ] Ensure smooth 60fps via requestAnimationFrame
- [ ] Test horizontal movement sync with vertical scroll

## Phase 7: Homepage Scroll Sections
- [ ] Rewrite index.astro with scroll-driven sections
- [ ] Create 300vh scroll container
- [ ] Implement sticky viewport
- [ ] Add Hero section with fade-out/slide-up
- [ ] Add Projects section with fade-in/fade-out
- [ ] Add Placeholder section ("What I Do")
- [ ] Calculate section offsets based on scroll position
- [ ] Test scroll flow in all directions

## Phase 8: View Transitions
- [ ] Add ViewTransitions to BaseLayout.astro head
- [ ] Add transition:animate directives to pages
- [ ] Test page navigation animations

## Phase 9: Build Verification
- [ ] Run npm run build — check for errors
- [ ] Test all pages render correctly
- [ ] Test scroll behavior on homepage
- [ ] Test parallax on projects section
- [ ] Test snow animation
- [ ] Test snowflake cursor
- [ ] Test Penrose triangle rotation
- [ ] Test page transitions

## Files Modified
1. `src/styles/global.css`
2. `src/layouts/BaseLayout.astro`
3. `src/components/BackgroundSnow.tsx` (renamed from BackgroundRain.tsx)
4. `src/components/SnowflakeCursor.tsx` (new)
5. `src/components/PenroseTriangle.tsx`
6. `src/components/ParallaxProjects.tsx`
7. `src/components/Header.astro`
8. `src/components/Footer.astro`
9. `src/components/FediverseFollow.astro`
10. `src/pages/index.astro`
11. `src/pages/about.astro`
12. `src/pages/resume.astro`
13. `src/pages/blog/index.astro`
14. `src/pages/blog/[...slug].astro`

## Dependencies
- No new npm packages required
- Astro View Transitions is built-in
- All animations use CSS + Canvas + SolidJS

## Estimated Effort
- Phase 1-2: 30 min (styling)
- Phase 3: 20 min (snow animation)
- Phase 4: 15 min (cursor)
- Phase 5: 30 min (Penrose triangle)
- Phase 6: 20 min (parallax fix)
- Phase 7: 45 min (scroll sections)
- Phase 8: 10 min (view transitions)
- Phase 9: 15 min (verification)
- **Total: ~3 hours**
