import About from "@/components/sections/About";
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
import { sectionLabel, sectionShown, type SectionId } from "@/lib/section-labels";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const c = await loadPublicContent();
  const shown = (id: SectionId) => sectionShown(c.profile, id);
  const label = (id: SectionId) => sectionLabel(c.profile, id);
  const showProjects = shown("projects") && c.projects.length > 0;
  const showArchitectures = shown("architectures") && c.architectures.length > 0;
  return (
    <>
      <Hero profile={c.profile} hasProjects={showProjects} hasArchitectures={showArchitectures} />
      {shown("about") && <About profile={c.profile} />}
      <Skills profile={c.profile} skills={c.skills} />
      {shown("resume") && <Resume profile={c.profile} experience={c.experience} certifications={c.certifications} />}
      {showProjects && <Projects projects={c.projects} title={label("projects")} />}
      {showArchitectures && <Architectures architectures={c.architectures} projects={c.projects} title={label("architectures")} />}
      {shown("current") && <CurrentProjects items={c.current} title={label("current")} />}
      {shown("certifications") && <Certifications items={c.certifications} title={label("certifications")} />}
      <CustomSections sections={c.sections} />
      {shown("contact") && <Contact profile={c.profile} />}
    </>
  );
}
