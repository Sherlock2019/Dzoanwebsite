import { dataProvider } from "@/lib/config";

/** Object storage for uploaded files. Keys are generated server-side (see lib/upload.ts). */
export interface ObjectStorage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<{ body: Buffer; contentType: string } | null>;
  remove(keys: string[]): Promise<void>;
}

// Only server-generated keys are accepted: <folder>/<year>/<uuid>[.thumb].<ext>
// "sources" holds documents uploaded for AI ingestion; they are never referenced by published
// content, so the media route only ever serves them to the signed-in owner.
const KEY_PATTERN =
  /^(images|documents|sources)\/\d{4}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\.thumb)?\.(png|jpg|webp|pdf|docx|txt|md)$/;

export function isValidKey(key: string): boolean {
  return KEY_PATTERN.test(key);
}

export const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain; charset=utf-8",
  md: "text/markdown; charset=utf-8",
};

export function contentTypeForKey(key: string): string {
  const ext = key.split(".").pop() || "";
  return CONTENT_TYPES[ext] || "application/octet-stream";
}

let storage: Promise<ObjectStorage> | null = null;

export function getStorage(): Promise<ObjectStorage> {
  if (!storage) {
    storage =
      dataProvider() === "supabase"
        ? import("./supabase").then((m) => m.createSupabaseStorage())
        : import("./local").then((m) => m.createLocalStorage());
  }
  return storage;
}
