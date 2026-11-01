import { describe, expect, it } from "vitest";
import { evidenceFound, proposalSchema } from "@/lib/ai/proposals";
import { chunkText, cleanText, detectDocType } from "@/lib/rag/parse";

describe("document type detection", () => {
  it("detects by bytes, not by name alone", () => {
    expect(detectDocType(Buffer.from("%PDF-1.7 ..."), "cv.pdf")).toBe("pdf");
    expect(detectDocType(Buffer.from("%PDF-1.7 ..."), "renamed.txt")).toBe("pdf");
    expect(detectDocType(Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2]), "cv.docx")).toBe("docx");
    expect(detectDocType(Buffer.from("hello"), "notes.md")).toBe("md");
  });
  it("rejects disguised or binary files", () => {
    expect(detectDocType(Buffer.from([0x50, 0x4b, 0x03, 0x04]), "archive.zip")).toBeNull();
    expect(detectDocType(Buffer.from([0x4d, 0x5a, 0x90, 0x00]), "evil.txt")).toBeNull();
    expect(detectDocType(Buffer.from("<script>"), "page.html")).toBeNull();
  });
});

describe("chunking", () => {
  it("keeps chunks under the size and covers all text", () => {
    const text = Array.from({ length: 40 }, (_, i) => `Paragraph ${i}. ${"word ".repeat(60)}`).join("\n\n");
    const chunks = chunkText(cleanText(text), 1200, 200);
    expect(chunks.length).toBeGreaterThan(5);
    expect(Math.max(...chunks.map((c) => c.length))).toBeLessThanOrEqual(1200 + 200 + 1);
    expect(chunks.join(" ")).toContain("Paragraph 39.");
  });
});

describe("evidence check", () => {
  const doc = "Gameloft — reduced cloud spend by approximately US$40,000 per month through usage analysis.";
  it("accepts quotes that appear in the document (ignoring case, quotes and spacing)", () => {
    expect(evidenceFound("reduced cloud spend by approximately US$40,000 per month", doc)).toBe(true);
    expect(evidenceFound("REDUCED  cloud spend … through usage analysis", doc)).toBe(true);
  });
  it("rejects invented or too-short quotes", () => {
    expect(evidenceFound("reduced cloud spend by US$90,000 per month", doc)).toBe(false);
    expect(evidenceFound("cloud", doc)).toBe(false);
    expect(evidenceFound("", doc)).toBe(false);
  });
});

describe("proposal validation", () => {
  it("accepts well-formed proposals and rejects unknown fields or kinds", () => {
    expect(proposalSchema.safeParse({ kind: "profile_field", field: "about", value: "New text", evidence: "x" }).success).toBe(true);
    expect(proposalSchema.safeParse({ kind: "profile_field", field: "email", value: "a@b.c" }).success).toBe(false);
    expect(proposalSchema.safeParse({ kind: "delete_everything", value: "x" }).success).toBe(false);
    expect(proposalSchema.safeParse({ kind: "project_new", value: { title: "X", summary: "Y" } }).success).toBe(true);
  });
});
