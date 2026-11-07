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

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const c = await loadPublicContent();
  return (
    <>
      <Hero profile={c.profile} hasProjects={c.projects.length > 0} hasArchitectures={c.architectures.length > 0} />
      <About profile={c.profile} />
      <Skills profile={c.profile} skills={c.skills} />
      <Resume profile={c.profile} experience={c.experience} certifications={c.certifications} />
      <Projects projects={c.projects} />
      <Architectures architectures={c.architectures} projects={c.projects} />
      <CurrentProjects items={c.current} />
      <Certifications items={c.certifications} />
      <CustomSections sections={c.sections} />
      <Contact profile={c.profile} />
    </>
  );
}
