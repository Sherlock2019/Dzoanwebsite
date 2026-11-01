"use client";

import { useMemo, useState } from "react";
import { LuArrowRight } from "react-icons/lu";
import MediaImage from "@/components/ui/MediaImage";
import StatusBadge from "@/components/ui/StatusBadge";
import { thumbUrl } from "@/lib/media-url";
import { PROJECT_CATEGORIES } from "@/lib/options";
import type { Project } from "@/lib/types";
import FilterBar, { matches } from "./FilterBar";
import SectionTitle from "./SectionTitle";

export function ProjectCard({ project }: { project: Project }) {
  const cover = project.media[0];
  return (
    <li className="project-card">
      <div className="project-media">
        <MediaImage src={thumbUrl(cover)} alt={cover?.alt || project.title} label={project.title} />
        <div className="project-overlay" aria-hidden>
          <p>{project.summary}</p>
          <span>
            View details <LuArrowRight />
          </span>
        </div>
      </div>
      <div className="project-body">
        <div className="card-badges">
          <StatusBadge status={project.status} />
          {project.featured && <span className="badge tone-gray">Featured</span>}
        </div>
        <h3>
          <a href={`/projects/${project.slug}`} className="stretched-link">
            {project.title}
          </a>
        </h3>
        {project.subtitle && <p className="card-subtitle">{project.subtitle}</p>}
        {project.context && <p className="card-context">{project.context}</p>}
        <p className="card-summary-touch">{project.summary}</p>
        {project.technologies.length > 0 && (
          <ul className="tags" aria-label="Technologies">
            {project.technologies.slice(0, 5).map((t) => (
              <li key={t}>{t}</li>
            ))}
            {project.technologies.length > 5 && <li>+{project.technologies.length - 5}</li>}
          </ul>
        )}
      </div>
    </li>
  );
}

/** Group projects by `group`, keeping list order; groups appear in order of their first project. */
function groupProjects(projects: Project[]): { name: string; items: Project[] }[] {
  const groups: { name: string; items: Project[] }[] = [];
  const anyGrouped = projects.some((p) => p.group?.trim());
  for (const p of projects) {
    const name = p.group?.trim() || (anyGrouped ? "Other projects" : "");
    const g = groups.find((x) => x.name === name);
    if (g) g.items.push(p);
    else groups.push({ name, items: [p] });
  }
  return groups;
}

export default function Projects({ projects }: { projects: Project[] }) {
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const filters = PROJECT_CATEGORIES.filter((c) => projects.some((p) => p.categories.includes(c)));
  const shown = useMemo(
    () =>
      projects.filter(
        (p) =>
          (filter === "All" || p.categories.includes(filter)) &&
          matches(query, [p.title, p.subtitle, p.summary, p.context, p.status, p.group, p.technologies, p.categories]),
      ),
    [projects, filter, query],
  );
  if (!projects.length) return null;

  return (
    <section id="projects" className="section section-alt" aria-labelledby="projects-title">
      <div className="container">
        <SectionTitle
          id="projects"
          title="Projects"
          intro="Evidence of how I work: what each project was for, what I built or designed, and its real delivery stage. Hover or tap a card for a summary."
        />
        <FilterBar
          id="projects"
          label="projects"
          filters={filters}
          active={filter}
          onFilter={setFilter}
          query={query}
          onQuery={setQuery}
          count={shown.length}
        />
        {shown.length ? (
          groupProjects(shown).map(({ name, items }) => (
            <div key={name || "_"} className="project-group">
              {name && <h3 className="project-group-title">{name}</h3>}
              <ul className="card-grid">
                {items.map((p) => (
                  <ProjectCard key={p.id} project={p} />
                ))}
              </ul>
            </div>
          ))
        ) : (
          <p className="empty-note">No projects match this filter.</p>
        )}
      </div>
    </section>
  );
}
