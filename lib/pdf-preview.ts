import sharp from "sharp";
import { renderPageAsImage } from "unpdf";
import { getStorage } from "@/lib/storage/index";
import type { Attachment } from "@/lib/types";

// Page-1 preview images for PDFs attached to custom sections. Rendered on the server (PDF.js via
// unpdf + @napi-rs/canvas) so visitors get a light, sharp image on any device, with no PDF viewer.

const PREVIEW_WIDTH = 900;

/** documents/2026/<uuid>.pdf → documents/2026/<uuid>.thumb.webp */
export function previewKeyFor(pdfKey: string): string {
  return pdfKey.replace(/\.pdf$/, ".thumb.webp");
}

async function renderFirstPage(pdf: Buffer): Promise<Buffer | null> {
  try {
    const png = await renderPageAsImage(new Uint8Array(pdf), 1, {
      canvasImport: () => import("@napi-rs/canvas"),
      width: PREVIEW_WIDTH,
    });
    return await sharp(Buffer.from(png)).flatten({ background: "#ffffff" }).webp({ quality: 80 }).toBuffer();
  } catch {
    return null; // encrypted or damaged PDF: the file link still works, just without a preview
  }
}

/**
 * Give every PDF in the list its page-1 preview, rendering any that are missing. The preview key is
 * derived from the PDF key, so a client can never point it at another file.
 */
export async function withPdfPreviews(files: Attachment[]): Promise<Attachment[]> {
  const storage = await getStorage();
  return Promise.all(
    files.map(async ({ key: fileKey, filename }) => {
      const file: Attachment = { key: fileKey, filename };
      if (!file.key.endsWith(".pdf")) return file;
      const key = previewKeyFor(file.key);
      if (await storage.get(key)) return { ...file, preview: key };
      const pdf = await storage.get(file.key);
      const image = pdf && (await renderFirstPage(pdf.body));
      if (!image) return file;
      await storage.put(key, image, "image/webp");
      return { ...file, preview: key };
    }),
  );
}
