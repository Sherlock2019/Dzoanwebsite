"use client";

import type { Media } from "@/lib/types";

export class ApiError extends Error {
  constructor(message: string, public status: number, public issues?: Record<string, string>) {
    super(message);
  }
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body instanceof FormData ? init.headers : { "Content-Type": "application/json", ...init?.headers },
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    window.location.href = "/admin/login";
  }
  if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status})`, res.status, data.issues);
  return data as T;
}

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 15 * 1024 * 1024;

/** Quick client-side check for a friendly message; the server re-validates everything. */
export function precheck(file: File, kind: "image" | "pdf"): string | null {
  if (file.size > MAX_BYTES) return `${file.name} is larger than 15 MB`;
  if (kind === "image" && !IMAGE_TYPES.includes(file.type)) return `${file.name}: only JPEG, PNG or WebP images`;
  if (kind === "pdf" && file.type !== "application/pdf") return `${file.name}: only PDF files`;
  return null;
}

export async function uploadImage(file: File, alt = ""): Promise<Media> {
  const problem = precheck(file, "image");
  if (problem) throw new ApiError(problem, 415);
  const form = new FormData();
  form.set("file", file);
  form.set("kind", "image");
  form.set("alt", alt);
  return api<Media>("/api/admin/upload", { method: "POST", body: form });
}

export async function uploadPdf(file: File): Promise<{ key: string; filename: string }> {
  const problem = precheck(file, "pdf");
  if (problem) throw new ApiError(problem, 415);
  const form = new FormData();
  form.set("file", file);
  form.set("kind", "pdf");
  return api("/api/admin/upload", { method: "POST", body: form });
}

/** Turn a filename into readable default alt text. */
export function altFromName(name: string): string {
  return name
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/\(\d+\)$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
