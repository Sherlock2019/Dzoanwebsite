import { describe, expect, it } from "vitest";
import { DEFAULT_VARIANT_ID, INTRO_TIMING, INTRO_VARIANTS, introStep, resolveVariant } from "@/lib/hero-intro";

const qa = resolveVariant("qa");
const poem = resolveVariant("poem");

describe("hero intro versions", () => {
  it("has stable, unique ids; Questions & Answers is the default", () => {
    const ids = INTRO_VARIANTS.map((v) => v.id);
    expect(ids).toEqual(["qa", "poem"]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(DEFAULT_VARIANT_ID).toBe("qa");
    expect(INTRO_VARIANTS.map((v) => v.label)).toEqual(["Questions & Answers", "If"]);
  });

  it("falls back to the default for a missing or unknown saved id", () => {
    expect(resolveVariant(null).id).toBe("qa");
    expect(resolveVariant("nonsense").id).toBe("qa");
    expect(resolveVariant("poem").id).toBe("poem");
  });

  it("ends every version with the closing invitation and calendar link", () => {
    for (const v of INTRO_VARIANTS) {
      const last = v.sections.at(-1)!;
      expect(last.kind).toBe("closing");
      expect(v.sections.slice(0, -1).every((s) => s.kind !== "closing")).toBe(true);
      if (last.kind !== "closing") continue;
      expect(last.invitation.lead).toBe("Then we really need to talk.");
      expect(last.invitation.link).toBe("book a moment in my calendar");
      expect(last.invitation.postscript).toBe("P.S. I’m not an AI chatbot. I’m a real human.");
    }
  });

  it("keeps the ten questions in the required order", () => {
    const topics = qa.sections.flatMap((s) => (s.kind === "qa" ? [s.topic] : []));
    expect(topics).toEqual([
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
  });

  it("has the twelve poem stanzas, exact first and last", () => {
    const stanzas = poem.sections.flatMap((s) => (s.kind === "stanza" ? [s.text] : []));
    expect(stanzas).toHaveLength(12);
    expect(poem.title).toBe("If — A Builder’s Promise");
    expect(stanzas[0]).toBe(
      "If, as a CEO, you see what could be,\nYet daily troubles keep that goal from view,\nLet’s name the pains and find the possibility—\nThen build the next step, and see it through.",
    );
    expect(stanzas[11]).toBe("And more than that, someone prepared to be\nA servant to your team,\nYour company,\nAnd your customers—");
    expect(stanzas.every((s) => s.split("\n").length === 4)).toBe(true);
  });

  it("visits every section in order, holding each 3 s after its fade-in, and stops at the invitation", () => {
    for (const v of INTRO_VARIANTS) {
      const n = v.sections.length;
      const visited = [0];
      let i = 0;
      for (let step = introStep(i, n); step; step = introStep(i, n)) {
        expect(step.delay).toBe(INTRO_TIMING.fadeMs + 3000);
        i = step.next;
        visited.push(i);
      }
      expect(visited).toEqual([...Array(n).keys()]);
      expect(introStep(n - 1, n)).toBeNull();
    }
    expect(INTRO_TIMING.holdMs).toBe(3000);
  });
});
