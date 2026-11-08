import ProfileEditor from "@/components/admin/ProfileEditor";
import { getProfile } from "@/lib/content";
import { getRepo } from "@/lib/db/index";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const [profile, sections] = await Promise.all([getProfile(), getRepo().then((r) => r.list("sections"))]);
  const custom = [...sections]
    .sort((a, b) => a.sort_order - b.sort_order)
    .filter((s) => s.slug)
    .map((s) => ({ slug: s.slug, title: s.title, live: s.visibility === "published" && s.entries.length > 0 }));
  return <ProfileEditor initial={profile} customSections={custom} />;
}
