import type { FlagCode } from "@/lib/flags";

// Inline SVG flags: emoji flags render as plain letters on Windows.
const VN_STAR = "15,4 16.35,8.15 20.71,8.15 17.18,10.71 18.53,14.85 15,12.29 11.47,14.85 12.82,10.71 9.29,8.15 13.65,8.15";

function Shapes({ code }: { code: FlagCode }) {
  switch (code) {
    case "vn":
      return (
        <>
          <rect width="30" height="20" fill="#DA251D" />
          <polygon points={VN_STAR} fill="#FFFF00" />
        </>
      );
    case "fr":
      return (
        <>
          <rect width="10" height="20" fill="#002395" />
          <rect x="10" width="10" height="20" fill="#fff" />
          <rect x="20" width="10" height="20" fill="#ED2939" />
        </>
      );
    case "it":
      return (
        <>
          <rect width="10" height="20" fill="#009246" />
          <rect x="10" width="10" height="20" fill="#fff" />
          <rect x="20" width="10" height="20" fill="#CE2B37" />
        </>
      );
    case "de":
      return (
        <>
          <rect width="30" height="6.67" fill="#000" />
          <rect y="6.67" width="30" height="6.67" fill="#DD0000" />
          <rect y="13.33" width="30" height="6.67" fill="#FFCE00" />
        </>
      );
    case "es":
      return (
        <>
          <rect width="30" height="20" fill="#AA151B" />
          <rect y="5" width="30" height="10" fill="#F1BF00" />
        </>
      );
    case "gb":
      return (
        <>
          <rect width="30" height="20" fill="#012169" />
          <path d="M0,0 L30,20 M30,0 L0,20" stroke="#fff" strokeWidth="4" />
          <path d="M0,0 L30,20 M30,0 L0,20" stroke="#C8102E" strokeWidth="1.5" />
          <path d="M15,0 V20 M0,10 H30" stroke="#fff" strokeWidth="6" />
          <path d="M15,0 V20 M0,10 H30" stroke="#C8102E" strokeWidth="3.5" />
        </>
      );
    case "us":
      return (
        <>
          <rect width="30" height="20" fill="#fff" />
          {[0, 2, 4, 6, 8, 10, 12].map((i) => (
            <rect key={i} y={(i * 20) / 13} width="30" height={20 / 13} fill="#B22234" />
          ))}
          <rect width="12" height={(7 * 20) / 13} fill="#3C3B6E" />
        </>
      );
  }
}

export default function Flag({ code, label }: { code: FlagCode; label: string }) {
  return (
    <svg className="flag" viewBox="0 0 30 20" role="img" aria-label={label}>
      <title>{label}</title>
      <Shapes code={code} />
    </svg>
  );
}
