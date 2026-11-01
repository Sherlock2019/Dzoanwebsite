"use client";

import { LuSearch } from "react-icons/lu";

interface Props {
  id: string;
  label: string;
  filters: string[];
  active: string;
  onFilter: (f: string) => void;
  query: string;
  onQuery: (q: string) => void;
  count: number;
}

export default function FilterBar({ id, label, filters, active, onFilter, query, onQuery, count }: Props) {
  return (
    <div className="filter-bar">
      <div className="filter-chips" role="group" aria-label={`Filter ${label}`}>
        {["All", ...filters].map((f) => (
          <button key={f} type="button" className={`chip${active === f ? " is-active" : ""}`} aria-pressed={active === f} onClick={() => onFilter(f)}>
            {f}
          </button>
        ))}
      </div>
      <div className="filter-search">
        <LuSearch aria-hidden />
        <label htmlFor={`${id}-search`} className="sr-only">
          Search {label}
        </label>
        <input
          id={`${id}-search`}
          type="search"
          placeholder={`Search ${label}…`}
          value={query}
          onChange={(e) => onQuery(e.target.value)}
        />
      </div>
      <p className="sr-only" aria-live="polite">
        {count} {label} shown
      </p>
    </div>
  );
}

export function matches(query: string, fields: (string | string[] | undefined)[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.flat().some((f) => (f || "").toLowerCase().includes(q));
}
