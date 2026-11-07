import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AdminNav from "@/components/admin/AdminNav";
import { getOwnerSession } from "@/lib/auth/guard";
import { getRepo } from "@/lib/db/index";
import "../admin.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Owner dashboard", robots: { index: false, follow: false } };

// Server-side gate for every dashboard page. API routes enforce the same check independently.
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const session = await getOwnerSession();
  if (!session) redirect("/admin/login");
  const sections = (await (await getRepo()).list("sections")).map((s) => ({ id: s.id, title: s.title, icon: s.icon }));
  return (
    <div className="admin-shell">
      <AdminNav email={session.sub} sections={sections} />
      <main className="admin-main">{children}</main>
    </div>
  );
}
