import { describe, expect, it } from "vitest";
import { bioItemFlags, citizenshipFlags, languageFlags } from "@/lib/flags";

describe("profile flags", () => {
  it("reads citizenship in the order written", () => {
    expect(citizenshipFlags("French & Vietnamese").map((f) => f.code)).toEqual(["fr", "vn"]);
    expect(citizenshipFlags("Vietnamese and French").map((f) => f.code)).toEqual(["vn", "fr"]);
  });

  it("reads spoken languages and ignores unknown ones", () => {
    const flags = languageFlags("English, French, Vietnamese (native level); good German; some Klingon");
    expect(flags.map((f) => f.code)).toEqual(["gb", "fr", "vn", "de"]);
    expect(flags[0].label).toBe("English");
  });

  it("reads flags from bio bullets", () => {
    expect(bioItemFlags("**Citizenship:** Vietnamese and French").map((f) => f.label)).toEqual([
      "Vietnamese citizenship",
      "French citizenship",
    ]);
    expect(bioItemFlags("**Languages:** English, French and Vietnamese at native level, plus good German").map((f) => f.code)).toEqual([
      "gb",
      "fr",
      "vn",
      "de",
    ]);
    expect(bioItemFlags("**My passion:** I play golf one-handed in France")).toEqual([]);
  });

  it("returns nothing for empty fields", () => {
    expect(citizenshipFlags("")).toEqual([]);
    expect(languageFlags("")).toEqual([]);
  });
});
