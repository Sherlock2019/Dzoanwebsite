import About from "@/components/sections/About";
import AIToolbox from "@/components/sections/AIToolbox";
import Architectures from "@/components/sections/Architectures";
import Certifications from "@/components/sections/Certifications";
import Contact from "@/components/sections/Contact";
import CurrentProjects from "@/components/sections/CurrentProjects";
import CustomSections from "@/components/sections/CustomSections";
import Hero from "@/components/sections/Hero";
import Projects from "@/components/sections/Projects";
import Resume from "@/components/sections/Resume";
import Skills from "@/components/sections/Skills";
import { loadPublicContent } from "@/lib/public-cache";
import { SECTION_LABELS, siteSections, type SiteSection } from "@/lib/section-labels";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const c = await loadPublicContent();
  // Same list and order as the left menu (Admin → Profile → Left menu & sections).
  const sections = siteSections(c);
  const has = (id: string) => sections.some((s) => s.id === id);

  function render({ id, label, custom }: SiteSection) {
    if (custom) return <CustomSections key={id} sections={[custom]} />;
    switch (id) {
      case "home":
        return <Hero key={id} profile={c.profile} hasProjects={has("projects")} hasArchitectures={has("architectures")} />;
      case "about":
        return <About key={id} profile={c.profile} />;
      case "skills":
      case "stacks":
        return <Skills key={id} profile={c.profile} skills={c.skills} part={id} />;
      case "resume":
        return <Resume key={id} profile={c.profile} experience={c.experience} certifications={c.certifications} />;
      case "projects":
        return <Projects key={id} projects={c.projects} title={label} />;
      case "architectures":
        return <Architectures key={id} architectures={c.architectures} projects={c.projects} title={label} />;
      case "current":
        return <CurrentProjects key={id} items={c.current} title={label} />;
      case "certifications":
        return <Certifications key={id} items={c.certifications} title={label} />;
      case "ai-toolbox":
        return <AIToolbox key={id} title={label === SECTION_LABELS["ai-toolbox"] ? undefined : label} />;
      case "contact":
        return <Contact key={id} profile={c.profile} />;
      default:
        return null;
    }
  }

  return <>{sections.map(render)}</>;
}
