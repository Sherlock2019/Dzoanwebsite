import { getPublicContent } from "@/lib/content";
import { siteUrl } from "@/lib/config";
import { phoneDigits } from "@/lib/text";

// Plain-text rendering of everything published on the site, for the chat assistant. Built only
// from published content (drafts never leak) and deterministic, so the prompt prefix caches.

const clean = (s: string | undefined) => (s || "").replace(/\*\*/g, "").replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)").trim();

export async function buildSiteContext(): Promise<string> {
  const c = await getPublicContent();
  const p = c.profile;
  const base = siteUrl();
  const out: string[] = [];

  out.push(`# ${p.name}`);
  out.push(
    [
      p.headline && `Headline: ${p.headline}`,
      p.tagline && `What I do: ${clean(p.tagline)}`,
      p.mission && `Mission: ${p.mission}`,
      p.how_i_work && `How I work: ${p.how_i_work}`,
      p.location && `Location: ${p.location}`,
      p.languages && `Languages: ${p.languages}`,
      p.citizenship && `Citizenship: ${p.citizenship}`,
      p.focus && `Focus: ${p.focus}`,
      p.current_role && `Current role: ${p.current_role}${p.current_company ? ` at ${p.current_company}` : ""}`,
    ]
      .filter(Boolean)
      .join("\n"),
  );
  if (p.about) out.push(`## Professional profile\n${clean(p.about)}`);
  if (p.bio) out.push(`## Bio\n${clean(p.bio)}`);
  if (p.stats.length) out.push(`## Headline numbers\n${p.stats.map((s) => `- ${s.value}: ${s.label}`).join("\n")}`);

  const contact = [
    p.email && `- Email: ${p.email}`,
    p.show_phone && p.phone && `- WhatsApp / phone: ${p.phone} (WhatsApp: https://wa.me/${phoneDigits(p.phone)})`,
    p.booking_url && `- Book an interview: ${p.booking_url}`,
    p.linkedin && `- LinkedIn: ${p.linkedin}`,
    p.github && `- GitHub: ${p.github}`,
    p.resume && `- Résumé PDF: ${base}/media/${p.resume.key}`,
  ].filter(Boolean);
  if (contact.length) out.push(`## Contact\n${contact.join("\n")}`);

  if (c.experience.length) {
    out.push(
      `## Experience\n${c.experience
        .map((e) =>
          [`### ${e.role} — ${e.company}${e.location ? `, ${e.location}` : ""} (${[e.start, e.end].filter(Boolean).join(" – ")})`, e.summary, ...e.bullets.map((b) => `- ${b}`)]
            .filter(Boolean)
            .join("\n"),
        )
        .join("\n\n")}`,
    );
  }

  if (c.projects.length) {
    out.push(
      `## Projects\n${c.projects
        .map((pr) =>
          [
            `### ${pr.title}${pr.group ? ` [${pr.group}]` : ""}`,
            `Delivery stage: ${pr.status}${pr.status_note ? ` — ${pr.status_note}` : ""}`,
            pr.context && `Context: ${pr.context}`,
            pr.subtitle,
            pr.summary,
            pr.problem && `Problem: ${clean(pr.problem)}`,
            pr.role && `Role: ${clean(pr.role)}`,
            pr.implementation && `What was built:\n${clean(pr.implementation)}`,
            pr.architecture && `Architecture: ${clean(pr.architecture)}`,
            pr.outcomes && `Outcomes:\n${clean(pr.outcomes)}`,
            pr.technologies.length && `Technologies: ${pr.technologies.join(", ")}`,
            pr.demo_url && `Live demo: ${pr.demo_url}`,
            pr.repo_url && `Source code: ${pr.repo_url}`,
            `Page: ${base}/projects/${pr.slug}`,
          ]
            .filter(Boolean)
            .join("\n"),
        )
        .join("\n\n")}`,
    );
  }

  if (c.architectures.length) {
    out.push(
      `## Architecture designs\n${c.architectures
        .map((a) => [`### ${a.title}`, `Type: ${a.status}`, a.summary, a.business_context && `Use case: ${a.business_context}`, `Page: ${base}/architectures/${a.slug}`].filter(Boolean).join("\n"))
        .join("\n\n")}`,
    );
  }

  if (c.skills.length) out.push(`## Skills\n${c.skills.map((s) => `### ${s.title}\n${s.items.join("; ")}`).join("\n")}`);
  if (c.certifications.length) {
    out.push(
      `## Certifications & learning\n${c.certifications
        .map((x) => `- ${x.title} — ${x.kind}${x.status === "In progress" ? " (in progress)" : ""}${x.issuer ? `, ${x.issuer}` : ""}${x.year ? `, ${x.year}` : ""}`)
        .join("\n")}`,
    );
  }
  for (const s of c.sections) {
    out.push(
      `## ${s.title}\n${s.entries
        .map((e) => [e.title && `### ${e.title}`, e.subtitle, e.text, e.url && `Link: ${e.url}`].filter(Boolean).join("\n"))
        .join("\n\n")}`,
    );
  }
  if (c.current.length) out.push(`## Current projects\n${c.current.map((x) => `### ${x.title} (${x.stage})\n${x.summary}`).join("\n\n")}`);

  return out.join("\n\n");
}
