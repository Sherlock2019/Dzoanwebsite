import { describe, expect, it } from "vitest";
import { DEFAULT_VARIANT_ID, INTRO_TIMING, INTRO_VARIANTS, qaStepMs, resolveVariant } from "@/lib/hero-intro";

const qa = resolveVariant("qa");
const poem = resolveVariant("poem");

describe("hero intro versions", () => {
  it("has stable, unique ids; The problems we will solve is the default", () => {
    const ids = INTRO_VARIANTS.map((v) => v.id);
    expect(ids).toEqual(["qa", "poem"]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(DEFAULT_VARIANT_ID).toBe("qa");
    expect(INTRO_VARIANTS.map((v) => v.label)).toEqual(["The problems we will solve", "If you need..."]);
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

  it("gives every Q&A section a stable id and topic-button label, in order", () => {
    const nav = qa.sections.map((s) => (s.kind === "qa" || s.kind === "closing" ? [s.id, s.nav] : null));
    expect(nav).toEqual([
      ["ceo", "CEO"],
      ["cfo", "CFO"],
      ["cto", "CTO"],
      ["ai-workflows", "AI Workflows"],
      ["data", "Data Insights"],
      ["mlops", "AI / MLOps"],
      ["cloud", "Cloud Architecture"],
      ["devops", "DevOps / SRE"],
      ["modernization", "App Modernization"],
      ["customers", "Customer Needs"],
      ["all", "All the Above"],
    ]);
  });

  it("keeps each question 7 s after its answer has typed out", () => {
    const ceo = qa.sections[0];
    expect(ceo.kind).toBe("qa");
    if (ceo.kind !== "qa") return;
    expect(INTRO_TIMING.holdMs).toBe(7000);
    expect(qaStepMs(ceo)).toBe(INTRO_TIMING.fadeMs + ceo.answer.length * INTRO_TIMING.typeCharMs + 7000);
    // The closing has nothing to type: fade + hold.
    expect(qaStepMs(qa.sections.at(-1)!)).toBe(INTRO_TIMING.fadeMs + 7000);
  });
});
