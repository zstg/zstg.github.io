const S = 'url(#pg)';

// Penrose impossible tribar, viewBox 0 0 200 200 (wireframe: outlines only).
// EVERY under-edge terminates exactly ON an over-edge (T-junction).
//   A  (beam1 over beam2): O2 starts (107,49) on I1; I2 starts (100,63) on I1
//   BR (beam2 over beam3): T3 ends (139,141) on I2; I2 ends (146,155) on B3
//   BL (beam3 over beam1): O1 ends (47,141) on T3; I1 ends (61,141) on T3

export default function PenroseTriangle() {
  return (
    <svg viewBox="0 0 200 200" class="w-48 h-48 md:w-64 md:h-64 block">
      <defs>
        <linearGradient id="pg" gradientUnits="userSpaceOnUse" x1="40" y1="35" x2="160" y2="155">
          <stop offset="0%" stop-color="#b6bdc9" />
          <stop offset="100%" stop-color="#6e7687" />
        </linearGradient>
      </defs>
      <g>
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 100 115"
          to="360 100 115"
          dur="20s"
          repeatCount="indefinite"
        />
        {/* wireframe: outlines only, no fills */}
        <g fill="none" stroke={S} stroke-width="2" stroke-linejoin="round" stroke-linecap="round">
          <line x1="100" y1="35" x2="47" y2="141" />
          <line x1="114" y1="35" x2="61" y2="141" />
          <line x1="100" y1="35" x2="114" y2="35" />
          <line x1="107" y1="49" x2="160" y2="155" />
          <line x1="100" y1="63" x2="146" y2="155" />
          <line x1="40" y1="141" x2="139" y2="141" />
          <line x1="40" y1="155" x2="160" y2="155" />
          <line x1="40" y1="141" x2="40" y2="155" />
        </g>
        {/* inner depth creases */}
        <g stroke={S} stroke-width="1.2" opacity="0.3">
          <line x1="107" y1="38" x2="55" y2="136" />
          <line x1="105" y1="62" x2="151" y2="150" />
          <line x1="44" y1="148" x2="149" y2="148" />
        </g>
      </g>
    </svg>
  );
}
