// Penrose impossible tribar.
//
// Geometry is the canonical construction (three square-section beams that
// interlock in painter's order), mapped from its native 280x243 space into a
// 200x200 viewBox. The transform puts the centroid exactly on (100,100), so
// the SMIL rotation below spins it in place with no wobble.
//
// Painter's order matters and is part of the illusion: each beam is an
// impossible closed loop, and the overlap is what fakes the depth.
const BEAMS = [
  // back beam
  'M 55.0625,182.4375 L 80.6875,182.5625 L 151.21875,59.84375 L 252.21615,228.15076 L 264.76729,205.25818 L 151.5625,13.25 L 55.0625,182.4375 Z',
  // middle beam
  'M 15.625,206.0625 L 27.5,228.4375 L 252.30454,228.28334 L 151.23246,59.859344 L 138.54873,81.934334 L 211.73429,205.92661 L 15.625,206.0625 Z',
  // front beam
  'M 124.05609,12.990601 L 15.638759,206.0253 L 211.76418,205.96833 L 197.88064,182.51185 L 54.948939,182.532 L 151.67357,13.253813 L 124.05609,12.990601 Z',
];

export default function PenroseTriangle() {
  return (
    <svg viewBox="0 0 200 200" class="w-48 h-48 md:w-64 md:h-64 block">
      <defs>
        <linearGradient id="pg" gradientUnits="userSpaceOnUse" x1="40" y1="35" x2="160" y2="155">
          <stop offset="0%" stop-color="#c3cad6" />
          <stop offset="100%" stop-color="#7b8494" />
        </linearGradient>
        {/* the three beams sit at different depths, so give each its own tone */}
        <linearGradient id="pg1" gradientUnits="userSpaceOnUse" x1="20" y1="20" x2="180" y2="180">
          <stop offset="0%" stop-color="#5a6273" />
          <stop offset="100%" stop-color="#3c4353" />
        </linearGradient>
        <linearGradient id="pg2" gradientUnits="userSpaceOnUse" x1="20" y1="20" x2="180" y2="180">
          <stop offset="0%" stop-color="#7b8496" />
          <stop offset="100%" stop-color="#565e70" />
        </linearGradient>
        <linearGradient id="pg3" gradientUnits="userSpaceOnUse" x1="20" y1="20" x2="180" y2="180">
          <stop offset="0%" stop-color="#b9c1cf" />
          <stop offset="100%" stop-color="#8d95a5" />
        </linearGradient>
      </defs>
      <g transform="translate(3.213 16.663) scale(0.69037)">
        <animateTransform
          attributeName="transform"
          additive="sum"
          type="rotate"
          from="0 100 100"
          to="360 100 100"
          dur="20s"
          repeatCount="indefinite"
        />
        <path d={BEAMS[0]} fill="url(#pg1)" stroke="url(#pg)" stroke-width="1.6" stroke-linejoin="round" />
        <path d={BEAMS[1]} fill="url(#pg2)" stroke="url(#pg)" stroke-width="1.6" stroke-linejoin="round" />
        <path d={BEAMS[2]} fill="url(#pg3)" stroke="url(#pg)" stroke-width="1.6" stroke-linejoin="round" />
      </g>
    </svg>
  );
}