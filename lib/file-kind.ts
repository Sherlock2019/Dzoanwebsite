import type { Attachment } from "@/lib/types";

/** "PDF" / "Word" / the file's own extension (custom-section files can be any type). */
export function fileKind(f: Attachment): string {
  if (f.key.endsWith(".pdf")) return "PDF";
  if (f.key.endsWith(".docx")) return "Word";
  return f.filename.match(/\.([a-z0-9]{1,8})$/i)?.[1].toUpperCase() || "File";
}
