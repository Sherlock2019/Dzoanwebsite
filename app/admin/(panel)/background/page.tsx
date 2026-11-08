import BackgroundEditor from "@/components/admin/BackgroundEditor";
import { getProfile } from "@/lib/content";
import { DEFAULT_SLIDE1_SETTINGS } from "@/lib/slide1-bg";

export const dynamic = "force-dynamic";

export default async function BackgroundPage() {
  const profile = await getProfile();
  return <BackgroundEditor initial={profile.slide1_bg ?? DEFAULT_SLIDE1_SETTINGS} />;
}
