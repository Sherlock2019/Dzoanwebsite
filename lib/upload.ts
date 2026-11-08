import { randomUUID } from "crypto";
import sharp from "sharp";
import { getStorage } from "@/lib/storage/index";
import type { Media } from "@/lib/types";

// Upload pipeline: detect the real file type from its bytes (never trust the filename or the
// browser's MIME type alone), enforce size limits, generate the storage key server-side and
// create a WebP thumbnail for images. Originals are kept byte-for-byte so diagram labels stay sharp.

export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_PDF_BYTES = 15 * 1024 * 1024;
const MAX_PIXELS = 16384 * 16384;
const THUMB_WIDTH = 960;

export type SniffedType = "png" | "jpg" | "webp" | "pdf";

const MIME: Record<SniffedType, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  pdf: "application/pdf",
};

export function sniffType(buf: Buffer): SniffedType | null {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  if (buf.length >= 5 && buf.toString("ascii", 0, 5) === "%PDF-") return "pdf";
  return null;
}

export class UploadError extends Error {}

function newKey(folder: "images" | "documents", ext: SniffedType): { base: string; key: string } {
  const base = `${folder}/${new Date().getUTCFullYear()}/${randomUUID()}`;
  return { base, key: `${base}.${ext}` };
}

/** Validate and store an image. Returns Media with original + thumbnail keys. */
export async function storeImage(buf: Buffer, declaredMime: string, alt = ""): Promise<Media> {
  if (buf.length === 0) throw new UploadError("Empty file");
  if (buf.length > MAX_IMAGE_BYTES) throw new UploadError("Image is larger than 15 MB");
  const type = sniffType(buf);
  if (!type || type === "pdf") throw new UploadError("Only JPEG, PNG or WebP images are accepted");
  if (declaredMime && declaredMime !== MIME[type]) {
    throw new UploadError(`File content is ${MIME[type]} but was sent as ${declaredMime}`);
  }

  let meta: sharp.Metadata;
  try {
    meta = await sharp(buf, { limitInputPixels: MAX_PIXELS }).metadata();
  } catch {
    throw new UploadError("The image could not be read (corrupted or unsupported)");
  }
  if (!meta.width || !meta.height) throw new UploadError("The image has no dimensions");

  const thumbBuf = await sharp(buf, { limitInputPixels: MAX_PIXELS })
    .rotate()
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

  const { base, key } = newKey("images", type);
  const thumb = `${base}.thumb.webp`;
  const storage = await getStorage();
  await storage.put(key, buf, MIME[type]);
  await storage.put(thumb, thumbBuf, MIME.webp);

  // EXIF orientation 5–8 swaps width/height when displayed.
  const rotated = meta.orientation && meta.orientation >= 5;
  return {
    key,
    thumb,
    alt: alt.slice(0, 300),
    width: rotated ? meta.height : meta.width,
    height: rotated ? meta.width : meta.height,
  };
}

/** Validate and store a PDF (résumé). */
export async function storePdf(buf: Buffer, declaredMime: string): Promise<string> {
  if (buf.length === 0) throw new UploadError("Empty file");
  if (buf.length > MAX_PDF_BYTES) throw new UploadError("PDF is larger than 15 MB");
  if (sniffType(buf) !== "pdf") throw new UploadError("Only PDF files are accepted");
  if (declaredMime && declaredMime !== MIME.pdf) throw new UploadError("File must be sent as application/pdf");
  const { key } = newKey("documents", "pdf");
  const storage = await getStorage();
  await storage.put(key, buf, MIME.pdf);
  return key;
}

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** A .docx is a ZIP whose entries include word/document.xml. Macro-enabled files are refused. */
function isDocx(buf: Buffer): boolean {
  if (buf.length < 4 || buf.readUInt32LE(0) !== 0x04034b50) return false;
  return buf.includes("word/document.xml") && !buf.includes("vbaProject.bin");
}

/** Validate and store a PDF or Word (.docx) document attached to a custom section. */
export async function storeDocument(buf: Buffer, name: string): Promise<{ key: string; filename: string }> {
  if (buf.length === 0) throw new UploadError("Empty file");
  if (buf.length > MAX_PDF_BYTES) throw new UploadError("Document is larger than 15 MB");
  const storage = await getStorage();
  if (sniffType(buf) === "pdf") {
    const { key } = newKey("documents", "pdf");
    await storage.put(key, buf, MIME.pdf);
    return { key, filename: safeFilename(name, "document.pdf") };
  }
  if (isDocx(buf)) {
    const key = `documents/${new Date().getUTCFullYear()}/${randomUUID()}.docx`;
    await storage.put(key, buf, DOCX_MIME);
    return { key, filename: safeFilename(name, "document.docx", "docx") };
  }
  throw new UploadError("Only PDF or Word (.docx) files are accepted. Save older .doc files as .docx first.");
}

/**
 * Store any file attached to a custom section. PDFs and Word files keep their type (PDFs open in
 * the browser and get a page-1 preview); everything else is stored opaquely as .bin and is only
 * ever served as a download with its original filename.
 */
export async function storeAnyFile(buf: Buffer, name: string): Promise<{ key: string; filename: string }> {
  if (buf.length === 0) throw new UploadError("Empty file");
  if (buf.length > MAX_PDF_BYTES) throw new UploadError("File is larger than 15 MB");
  if (sniffType(buf) === "pdf" || isDocx(buf)) return storeDocument(buf, name);
  const key = `documents/${new Date().getUTCFullYear()}/${randomUUID()}.bin`;
  await (await getStorage()).put(key, buf, "application/octet-stream");
  return { key, filename: safeFilename(name, "file", "") };
}

/** Background videos: kept under the 50 MB request limit of the server's web proxy. */
export const MAX_VIDEO_BYTES = 45 * 1024 * 1024;

/** The real type of a video from its first bytes: MP4 ("ftyp" box) or WebM (EBML header). */
export function sniffVideo(buf: Buffer): "mp4" | "webm" | null {
  if (buf.length >= 12 && buf.toString("latin1", 4, 8) === "ftyp") return "mp4";
  if (buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return "webm";
  return null;
}

/** Validate and store a background video (MP4 or WebM, checked from its bytes). */
export async function storeVideo(buf: Buffer, name: string): Promise<{ key: string; filename: string }> {
  if (buf.length === 0) throw new UploadError("Empty file");
  if (buf.length > MAX_VIDEO_BYTES) throw new UploadError("Video is larger than 45 MB. Please compress it (a short 1080p loop is plenty).");
  const type = sniffVideo(buf);
  if (!type) throw new UploadError("Only MP4 or WebM videos are accepted");
  const key = `videos/${new Date().getUTCFullYear()}/${randomUUID()}.${type}`;
  await (await getStorage()).put(key, buf, type === "mp4" ? "video/mp4" : "video/webm");
  return { key, filename: safeFilename(name, `background.${type}`, "") };
}

/** Make a safe download filename from user input. ext "" keeps whatever extension it has. */
export function safeFilename(name: string, fallback = "resume.pdf", ext = "pdf"): string {
  const base = name.split(/[\\/]/).pop() || "";
  const cleaned = base.replace(/[^\w .()-]+/g, "_").replace(/^\.+/, "").slice(0, 120).trim();
  if (!cleaned) return fallback;
  if (!ext) return cleaned;
  return new RegExp(`\\.${ext}$`, "i").test(cleaned) ? cleaned : `${cleaned}.${ext}`;
}
