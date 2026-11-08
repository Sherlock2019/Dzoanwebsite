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
    expect(INTRO_VARIANTS.map((v) => v.label)).toEqual(["Questions & Answers", "If you need..."]);
  });

  it("falls back to the default for a missing or unknown saved id", () => {
    expect(resolveVariant(null).id).toBe("qa");
    expect(resolveVariant("nonsense").id).toBe("qa");
    expect(resolveVariant("poem").id).toBe("poem");
  });

  it("ends slide 1 on 'Then we really need to talk.' and puts 'I’m here…' on slide 2", () => {
    for (const v of INTRO_VARIANTS) {
      const end = v.sections.at(-1)!;
      expect(end.kind === "closing" && end.talk).toBe("Then we really need to talk.");
      expect(v.invitation.before.startsWith("I’m here.")).toBe(true);
      expect(v.invitation.link).toBe("book a moment in my calendar");
      expect(v.invitation.postscript).toBe("P.S. I’m not an AI chatbot. I’m a real human.");
    }
    const qaEnd = qa.sections.at(-1)!;
    expect(qaEnd.kind === "closing" && qaEnd.headline).toBe("And if you need all the above in one person?");
    expect(qaEnd.kind === "closing" && qaEnd.subhead).toBe("And more than that—\na servant to your team,\nyour company,\nand your customers.");
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
    expect(stanzas[11]).toBe(
      "And more than that, someone prepared to be\nA servant to your team,\nYour company,\nyour customers—\nand you want to Build Together an Earth of Abundance and prosperity for Us and generations to come ...",
    );
    const first = poem.sections[0];
    expect(first.kind === "stanza" && first.note).toBe("Inspired by Rudyard Kipling’s poem “If—”");
    expect(`${poem.invitation.after}${poem.invitation.end}`).toBe("—\nI’ll be listening.");
    expect(stanzas.slice(0, 11).every((s) => s.split("\n").length === 4)).toBe(true);
    expect(stanzas[11].split("\n")).toHaveLength(5);
  });

  it("visits every section in order, holding each 5 s after its fade-in, then moves to slide 2", () => {
    for (const v of INTRO_VARIANTS) {
      const n = v.sections.length;
      const visited = [0];
      let i = 0;
      for (let step = introStep(i, n); step; step = introStep(i, n)) {
        expect(step.delay).toBe(INTRO_TIMING.fadeMs + 5000);
        i = step.next;
        visited.push(i);
      }
      // 0 … n-1 are the sections; n means "slide 2", after the last section's hold.
      expect(visited).toEqual([...Array(n + 1).keys()]);
      expect(introStep(n, n)).toBeNull();
    }
    expect(INTRO_TIMING.holdMs).toBe(5000);
  });
});
