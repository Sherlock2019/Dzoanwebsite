// Recommendation badge: a gold rosette with a star and ribbon tails, offered on an open hand.
// Pure SVG, drawn to match the Medal (components/ui/Medal.tsx).

const CX = 32;
const CY = 21;

/** Scalloped rosette outline: 14 rounded bumps around the centre. */
function rosettePath(r: number, bump: number, n = 14) {
  const pts: string[] = [];
  for (let i = 0; i <= n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? r + bump : r - bump * 0.3;
    pts.push(`${(CX + rr * Math.cos(a)).toFixed(2)} ${(CY + rr * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join(" L")} Z`;
}

/** Five-pointed star centred on the rosette. */
function starPath(outer: number, inner: number) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    pts.push(`${(CX + r * Math.cos(a)).toFixed(2)} ${(CY + r * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join(" L")} Z`;
}

export default function RecommendationIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 76" className={className} aria-hidden focusable="false">
      <defs>
        <radialGradient id="reco-gold" cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#fff6c4" />
          <stop offset="45%" stopColor="#f3c94a" />
          <stop offset="100%" stopColor="#b8841a" />
        </radialGradient>
      </defs>
      {/* ribbon tails with notched ends */}
      <polygon points="24,28 31,31 27,47 23.5,43.5 19.5,45" fill="#1f4e9c" />
      <polygon points="40,28 33,31 37,47 40.5,43.5 44.5,45" fill="#c8202f" />
      {/* rosette */}
      <path d={rosettePath(14, 2.6)} fill="url(#reco-gold)" stroke="#946410" strokeWidth="1" strokeLinejoin="round" />
      <circle cx={CX} cy={CY} r="10" fill="none" stroke="#ffffff" strokeWidth="1.6" opacity="0.9" />
      <path d={starPath(6.6, 2.8)} fill="#ffffff" stroke="#a4720e" strokeWidth="0.6" strokeLinejoin="round" />
      {/* open hand, palm up */}
      <g fill="currentColor">
        <rect x="2" y="56" width="7" height="17" rx="1.5" />
        <path d="M10 58.5 C15 54 21 52 27.5 52.6 L39.5 53.6 C43.4 53.9 43.6 59.2 39.6 59.4 L30.5 59.8 L31 61.6 L44.5 61.4 L55.2 54.6 C58.6 52.6 62 56.6 59.3 59.6 L49.4 69.3 C47.6 71 45.4 71.8 42.9 71.8 L22.5 71.8 L10 73.2 Z" />
      </g>
    </svg>
  );
}
