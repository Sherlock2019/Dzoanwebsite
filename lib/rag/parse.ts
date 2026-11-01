import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";

// Turns an uploaded file into plain text. The type is detected from the bytes (PDF, DOCX = ZIP)
// plus the file extension for plain text; anything else is rejected.

export const MAX_DOC_BYTES = 20 * 1024 * 1024;
export const MAX_DOC_CHARS = 600_000;

export type DocType = "pdf" | "docx" | "txt" | "md";

export const DOC_MIME: Record<DocType, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  md: "text/markdown",
};

export class ParseError extends Error {}

export function detectDocType(buf: Buffer, filename: string): DocType | null {
  const ext = filename.toLowerCase().split(".").pop() || "";
  if (buf.subarray(0, 5).toString("ascii") === "%PDF-") return "pdf";
  const isZip = buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
  if (isZip && ext === "docx") return "docx";
  if ((ext === "txt" || ext === "md") && !buf.includes(0)) return ext;
  return null;
}

/** Normalise whitespace while keeping paragraph breaks. */
export function cleanText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n[ ]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function parseDocument(buf: Buffer, type: DocType): Promise<string> {
  let text = "";
  try {
    if (type === "pdf") {
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      const result = await extractText(pdf, { mergePages: false });
      text = (result.text as string[]).join("\n\n");
    } else if (type === "docx") {
      text = (await mammoth.extractRawText({ buffer: buf })).value;
    } else {
      text = buf.toString("utf8");
    }
  } catch (err) {
    throw new ParseError(`Could not read this ${type.toUpperCase()} file: ${(err as Error).message}`);
  }
  text = cleanText(text);
  if (!text) throw new ParseError("No text found (a scanned PDF needs OCR first).");
  if (text.length > MAX_DOC_CHARS) throw new ParseError(`Document is too long (${text.length.toLocaleString()} characters; max ${MAX_DOC_CHARS.toLocaleString()}).`);
  return text;
}

/** Split text into overlapping chunks on paragraph/sentence boundaries. */
export function chunkText(text: string, size = 1200, overlap = 200): string[] {
  const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const pieces: string[] = [];
  for (const p of paras) {
    if (p.length <= size) pieces.push(p);
    else pieces.push(...(p.match(/[^.!?\n]+[.!?]*\s*/g) || [p]).map((s) => s.trim()).filter(Boolean));
  }
  const chunks: string[] = [];
  let current = "";
  for (const piece of pieces) {
    // A single sentence longer than the chunk size is hard-split.
    for (let i = 0; i < piece.length; i += size) {
      const part = piece.slice(i, i + size);
      if (current && current.length + part.length + 1 > size) {
        chunks.push(current);
        current = current.slice(-overlap) + " " + part;
      } else {
        current = current ? `${current}\n${part}` : part;
      }
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}
