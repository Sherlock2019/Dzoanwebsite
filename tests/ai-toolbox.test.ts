import { describe, expect, it } from "vitest";
import { filterTools, TOOL_CATEGORIES, TOOLS } from "@/lib/ai-toolbox";
import { defaultOrder } from "@/lib/section-labels";

describe("AI Useful Toolbox", () => {
  it("lists 19 distinct tools with clean https links", () => {
    expect(TOOLS).toHaveLength(19);
    expect(new Set(TOOLS.map((t) => t.name)).size).toBe(19);
    expect(new Set(TOOLS.map((t) => t.url)).size).toBe(19);
    for (const t of TOOLS) {
      const u = new URL(t.url);
      expect(u.protocol).toBe("https:");
      expect(u.search).toBe(""); // no tracking parameters
      expect(t.purpose.length).toBeGreaterThan(10);
    }
    expect(TOOLS.filter((t) => t.category === "evaluation")).toHaveLength(9);
    expect(TOOLS.filter((t) => t.category === "monitoring")).toHaveLength(4);
    expect(TOOLS.filter((t) => t.category === "benchmarks")).toHaveLength(6);
  });

  it("combines the category filter with search by name or purpose", () => {
    expect(filterTools(TOOLS, "All", "")).toHaveLength(19);
    expect(filterTools(TOOLS, "Monitoring", "")).toHaveLength(4);
    expect(filterTools(TOOLS, "All", "grafana").map((t) => t.name)).toEqual(["Grafana"]);
    expect(filterTools(TOOLS, "All", "  EMBEDDING ").map((t) => t.name)).toEqual(["MTEB leaderboard"]); // purpose
    expect(filterTools(TOOLS, "Benchmarks", "grafana")).toEqual([]);
    expect(TOOL_CATEGORIES.map((c) => c.filter)).toEqual(["Evaluation", "Monitoring", "Benchmarks"]);
  });

  it("sits just before Contact", () => {
    const order = defaultOrder(["awards"]);
    expect(order.slice(-3)).toEqual(["awards", "ai-toolbox", "contact"]);
  });
});
