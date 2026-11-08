"use client";

import { useId, useState } from "react";
import { LuActivity, LuExternalLink, LuFlaskConical, LuRotateCcw, LuSearch, LuTrophy } from "react-icons/lu";
import { filterTools, TOOL_CATEGORIES, TOOLBOX_SUBTITLE, TOOLBOX_TITLE, TOOLS, type ToolCategory } from "@/lib/ai-toolbox";
import SectionTitle from "./SectionTitle";
import "./AIToolbox.css";

const CATEGORY_ICON: Record<ToolCategory, typeof LuActivity> = { evaluation: LuFlaskConical, monitoring: LuActivity, benchmarks: LuTrophy };
const FILTERS = ["All", ...TOOL_CATEGORIES.map((c) => c.filter)];

/** AI Useful Toolbox (#ai-toolbox): curated external tools by category, with search and filters. Shared by V2, V3 and V4. */
export default function AIToolbox({ title = TOOLBOX_TITLE }: { title?: string }) {
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const searchId = useId();
  const shown = filterTools(TOOLS, filter, query);
  const reset = () => {
    setFilter("All");
    setQuery("");
  };

  return (
    <section id="ai-toolbox" className="section toolbox" aria-labelledby="ai-toolbox-title">
      <div className="container">
        <SectionTitle id="ai-toolbox" title={title} intro={TOOLBOX_SUBTITLE} />

        <div className="filter-bar">
          <div className="filter-chips" role="group" aria-label="Filter tools by category">
            {FILTERS.map((f) => (
              <button key={f} type="button" className={`chip${filter === f ? " is-active" : ""}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>
                {f}
              </button>
            ))}
          </div>
          <div className="filter-search">
            <LuSearch aria-hidden />
            <label htmlFor={searchId} className="sr-only">
              Search tools by name or purpose
            </label>
            <input id={searchId} type="search" placeholder="Search tools…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
        <p className="toolbox-count" aria-live="polite">
          {shown.length === TOOLS.length ? `${TOOLS.length} tools` : `${shown.length} of ${TOOLS.length} tools`}
        </p>

        {shown.length === 0 ? (
          <div className="empty-note toolbox-empty">
            <p>No tool matches {query.trim() ? <>“{query.trim()}”</> : "this filter"}.</p>
            <button type="button" className="chip" onClick={reset}>
              <LuRotateCcw aria-hidden /> Reset
            </button>
          </div>
        ) : (
          TOOL_CATEGORIES.map((cat) => {
            const tools = shown.filter((t) => t.category === cat.id);
            if (!tools.length) return null;
            const Icon = CATEGORY_ICON[cat.id];
            return (
              <div key={cat.id} className="toolbox-group">
                <h3 className="project-group-title">
                  <Icon aria-hidden className="toolbox-group-icon" /> {cat.title}
                </h3>
                <p className="toolbox-note">{cat.note}</p>
                <ul className="toolbox-grid">
                  {tools.map((t) => (
                    <li key={t.name} className="toolbox-card">
                      <span className={`toolbox-tag tag-${cat.id}`}>{cat.filter}</span>
                      <h4>{t.name}</h4>
                      <p>{t.purpose}</p>
                      <a href={t.url} target="_blank" rel="noopener noreferrer" aria-label={`Open the ${t.name} website (opens in a new tab)`}>
                        Open website <LuExternalLink aria-hidden />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
