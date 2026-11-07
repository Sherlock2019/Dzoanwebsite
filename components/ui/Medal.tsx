// Medal of honour: tricolour ribbon, ring, and a polished disc with a laurel wreath and plaque.
// Pure SVG (no image files), so it stays sharp at any size and needs no extra request.

export type MedalTone = "gold" | "silver" | "bronze";

const TONES: Record<MedalTone, { hi: string; mid: string; low: string; rim: string; leaf: string }> = {
  gold: { hi: "#fff6c4", mid: "#f3c94a", low: "#b8841a", rim: "#946410", leaf: "#a4720e" },
  silver: { hi: "#ffffff", mid: "#d3d8de", low: "#8d969f", rim: "#6c747d", leaf: "#7a838c" },
  bronze: { hi: "#ffe3cb", mid: "#da9566", low: "#9b5a2f", rim: "#7a4320", leaf: "#874c25" },
};

const CX = 32;
const CY = 62;

const R = 12.4; // laurel stem radius
const START = 122; // degrees, bottom-left (SVG y points down)
const END = 238; // top-left

/** One laurel branch on the left (mirror = right): a curved stem with leaf pairs pointing upward along it. */
function laurel(mirror: boolean, color: string) {
  const mx = (x: number) => (mirror ? 2 * CX - x : x);
  const ma = (deg: number) => (mirror ? 180 - deg : deg);
  const p = (deg: number, r: number) => [CX + r * Math.cos((deg * Math.PI) / 180), CY + r * Math.sin((deg * Math.PI) / 180)];
  const [sx, sy] = p(START, R);
  const [ex, ey] = p(END, R);
  const parts = [
    <path key="stem" d={`M${mx(sx)} ${sy} A${R} ${R} 0 0 ${mirror ? 0 : 1} ${mx(ex)} ${ey}`} fill="none" stroke={color} strokeWidth="0.7" />,
  ];
  for (let i = 0; i < 6; i++) {
    const deg = START + 8 + i * 19;
    const tangent = deg + 90; // direction of travel along the stem (upwards)
    for (const [side, r] of [[1, R + 1.9], [-1, R - 1.9]] as const) {
      const [x, y] = p(deg, r);
      const angle = ma(tangent + side * 22);
      parts.push(<ellipse key={`${i}${side}`} cx={mx(x)} cy={y} rx={2.3} ry={0.95} transform={`rotate(${angle} ${mx(x)} ${y})`} />);
    }
  }
  const [tx, ty] = p(END + 4, R);
  parts.push(<ellipse key="tip" cx={mx(tx)} cy={ty} rx={2.1} ry={0.9} transform={`rotate(${ma(END + 94)} ${mx(tx)} ${ty})`} />);
  return parts;
}

export default function Medal({ tone = "gold", className }: { tone?: MedalTone; className?: string }) {
  const c = TONES[tone];
  const id = `medal-${tone}`;
  // Ribbon bands: left strap in three stripes; the right strap mirrors it.
  const strap = (mirror: boolean) => {
    const m = (x: number) => (mirror ? 64 - x : x);
    const band = (x0: number, x1: number, b0: number, b1: number, fill: string, key: string) => (
      <polygon key={key} fill={fill} points={`${m(x0)},0 ${m(x1)},0 ${m(b1)},${38 - (b1 - 28) / 4} ${m(b0)},${38 - (b0 - 28) / 4}`} />
    );
    return [
      band(9, 14.7, 27, 29.7, "#1f4e9c", `b${mirror}`),
      band(14.7, 20.3, 29.7, 32.3, "#f4f6fa", `w${mirror}`),
      band(20.3, 26, 32.3, 35, "#c8202f", `r${mirror}`),
    ];
  };
  return (
    <svg viewBox="0 0 64 88" className={className} aria-hidden focusable="false">
      <defs>
        <radialGradient id={`${id}-disc`} cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor={c.hi} />
          <stop offset="45%" stopColor={c.mid} />
          <stop offset="100%" stopColor={c.low} />
        </radialGradient>
        <linearGradient id={`${id}-face`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={c.hi} />
          <stop offset="55%" stopColor={c.mid} />
          <stop offset="100%" stopColor={c.low} />
        </linearGradient>
      </defs>
      {/* ribbon: the right strap sits behind the left one */}
      <g>{strap(true)}</g>
      <g>{strap(false)}</g>
      <path d="M27 31 L32 39 L37 31" fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth="1" />
      {/* ring */}
      <rect x="27.5" y="36" width="9" height="6" rx="2.5" fill="none" stroke={c.rim} strokeWidth="2.2" />
      {/* disc */}
      <circle cx={CX} cy={CY} r="21.5" fill={`url(#${id}-disc)`} stroke={c.rim} strokeWidth="1.2" />
      <circle cx={CX} cy={CY} r="17.5" fill={`url(#${id}-face)`} stroke={c.low} strokeWidth="0.8" opacity="0.95" />
      <g fill={c.leaf} opacity="0.85">
        {laurel(false, c.leaf)}
        {laurel(true, c.leaf)}
      </g>
      <rect x="28" y="72.5" width="8" height="2.8" rx="0.6" fill="none" stroke={c.leaf} strokeWidth="0.8" opacity="0.85" />
      {/* shine */}
      <path d="M17 54 A16 16 0 0 1 30 45" fill="none" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}
