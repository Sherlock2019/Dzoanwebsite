// Renders owner-entered plain text safely (React escapes everything; no HTML is interpreted).
// Blank lines separate paragraphs; lines starting with "- " or "• " become bullet lists;
// **text** becomes bold; [label](https://…) becomes a link.

import { isHttpUrl } from "@/lib/text";

export function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={i}>{part.slice(2, -2)}</strong>;
    const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
    if (link) {
      // Only http(s) links become clickable; anything else stays plain text.
      return isHttpUrl(link[2]) ? (
        <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer">
          {link[1]}
        </a>
      ) : (
        link[1]
      );
    }
    return part;
  });
}

export default function RichText({ text, className }: { text: string; className?: string }) {
  if (!text?.trim()) return null;
  const blocks = text.replace(/\r\n/g, "\n").trim().split(/\n\s*\n/);
  return (
    <div className={className ? `rich-text ${className}` : "rich-text"}>
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        const isList = lines.every((l) => /^\s*[-•]\s+/.test(l));
        if (isList) {
          return (
            <ul key={i}>
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*[-•]\s+/, ""))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {inline(l)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
