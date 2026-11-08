import { describe, expect, it } from "vitest";
import { INTRO_VARIANTS, INVITATION, POEM, QA_CLOSING, QA_ITEMS, resolveVariant, SLIDE_NAMES, TALK } from "@/lib/hero-intro";

describe("hero carousel content (v4)", () => {
  it("has two slides and two versions of slide 1; Questions & Answers is the default", () => {
    expect(SLIDE_NAMES).toHaveLength(2);
    expect(INTRO_VARIANTS.map((v) => v.id)).toEqual(["qa", "poem"]);
    expect(INTRO_VARIANTS.map((v) => v.label)).toEqual(["Questions & Answers", "If you need..."]);
    expect(resolveVariant(null)).toBe("qa");
    expect(resolveVariant("nonsense")).toBe("qa");
    expect(resolveVariant("poem")).toBe("poem");
  });

  it("keeps the ten questions in the required order, then the closing", () => {
    expect(QA_ITEMS.map((q) => q.topic)).toEqual([
      "CEO",
      "CFO",
      "CTO",
      "AI workflows",
      "Data",
      "AI reliability · MLOps",
      "Cloud",
      "DevOps · SRE",
      "Modernization",
      "Customer understanding",
    ]);
    expect(QA_ITEMS.every((q) => q.question && q.answer)).toBe(true);
    expect(QA_CLOSING.headline).toBe("And if you need all the above in one person?");
  });

  it("has the whole poem: attribution, twelve stanzas, the abundance stanza last", () => {
    expect(POEM.title).toBe("If — A Builder’s Promise");
    expect(POEM.note).toBe("Inspired by Rudyard Kipling’s poem “If—”");
    expect(POEM.stanzas).toHaveLength(12);
    expect(POEM.stanzas[0].text.split("\n")[0]).toBe("If, as a CEO, you see what could be,");
    expect(POEM.stanzas[11].text).toBe(
      "And more than that, someone prepared to be\nA servant to your team,\nYour company,\nAnd your customers—\nWorking toward an Earth of abundance\nAnd prosperity for all of us.",
    );
  });

  it("ends slide 1 with 'Then we really need to talk.' and puts the calendar invitation on slide 2", () => {
    expect(TALK).toBe("Then we really need to talk.");
    for (const inv of [INVITATION, POEM.invitation]) {
      expect(inv.before.startsWith("I’m here.")).toBe(true);
      expect(inv.link).toBe("book a moment in my calendar");
      expect(inv.postscript).toBe("P.S. I’m not an AI chatbot. I’m a real human.");
    }
    expect(`${POEM.invitation.after}${POEM.invitation.end}`).toBe("—\nI’ll be listening.");
  });
});
