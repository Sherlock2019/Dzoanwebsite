import ProfileEditor from "@/components/admin/ProfileEditor";
import { getProfile } from "@/lib/content";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  return <ProfileEditor initial={await getProfile()} />;
}
