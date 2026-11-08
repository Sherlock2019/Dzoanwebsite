import { describe, expect, it } from "vitest";
import { applyOrder, defaultOrder } from "@/lib/section-labels";
import { isValidKey } from "@/lib/storage/index";
import { safeFilename } from "@/lib/upload";

describe("section order", () => {
  const defaults = defaultOrder(["awards"]);

  it("uses the default order when nothing is saved", () => {
    expect(applyOrder(defaults, [])).toEqual(defaults);
  });

  it("keeps the saved order and drops sections that no longer exist", () => {
    const saved = ["contact", "gone", ...defaults.filter((id) => id !== "contact")];
    expect(applyOrder(defaults, saved)[0]).toBe("contact");
    expect(applyOrder(defaults, saved)).not.toContain("gone");
  });

  it("places a newly added custom section after its default predecessor", () => {
    const saved = defaultOrder([]).reverse();
    const out = applyOrder(defaultOrder(["awards"]), saved);
    expect(out).toHaveLength(defaults.length);
    expect(out.indexOf("awards")).toBe(out.indexOf("certifications") + 1);
  });
});

describe("any-type uploads", () => {
  it("accepts opaque .bin keys under documents/", () => {
    expect(isValidKey("documents/2026/123e4567-e89b-42d3-a456-426614174000.bin")).toBe(true);
  });

  it("keeps the original extension when ext is empty", () => {
    expect(safeFilename("my slides.pptx", "file", "")).toBe("my slides.pptx");
    expect(safeFilename("../../x.zip", "file", "")).toBe("x.zip");
  });
});
