import BackgroundEditor from "@/components/admin/BackgroundEditor";
import { getProfile } from "@/lib/content";
import { normalizeSettings } from "@/lib/slide1-bg";

export const dynamic = "force-dynamic";

export default async function BackgroundPage() {
  const profile = await getProfile();
  return <BackgroundEditor initial={normalizeSettings(profile.slide1_bg)} />;
}
