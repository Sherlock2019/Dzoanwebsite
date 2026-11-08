import Link from "next/link";
import { COLLECTION_CONFIG } from "@/lib/admin/collections";
import { visitorCounts } from "@/lib/analytics";
import { dataProvider } from "@/lib/config";
import { getProfile } from "@/lib/content";
import { getRepo } from "@/lib/db/index";
import { COLLECTIONS } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const repo = await getRepo();
  const [profile, visitors, counts] = await Promise.all([
    getProfile(),
    visitorCounts(),
    Promise.all(
      COLLECTIONS.map(async (c) => {
        const items = await repo.list(c);
        return { c, total: items.length, published: items.filter((i) => i.visibility === "published").length };
      }),
    ),
  ]);
  const provider = dataProvider();

  return (
    <div>
      <div className="admin-form-head">
        <div>
          <h1>Dashboard</h1>
          <p className="hint">
            Signed in as the owner. Data provider: <strong>{provider}</strong>
            {provider === "local" && " — durable only while the data folder is on persistent storage (see README)."}
          </p>
        </div>
      </div>
      <ul className="dash-grid">
        <li>
          <Link href="/admin/analytics" className="dash-card">
            <strong>Visitors</strong>
            <span>
              {visitors.today} today · {visitors.week} in 7 days · {visitors.month} in 30 days
            </span>
          </Link>
        </li>
        <li>
          <Link href="/admin/profile" className="dash-card">
            <strong>Profile &amp; résumé</strong>
            <span>{profile.image ? "Photo uploaded" : "No photo yet"} · {profile.resume ? "Résumé PDF uploaded" : "No résumé PDF"}</span>
          </Link>
        </li>
        {counts.map(({ c, total, published }) => (
          <li key={c}>
            <Link href={`/admin/${c}`} className="dash-card">
              <strong>{COLLECTION_CONFIG[c].label}</strong>
              <span>
                {published} published · {total - published} draft
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <section className="admin-fieldset">
        <h2>Quick guide</h2>
        <ul className="rich-text">
          <li>Everything you create starts as a <strong>draft</strong>. Drafts and their images are invisible to visitors.</li>
          <li>Use <strong>Save &amp; publish</strong> (or Publish in a list) to make an item public; Unpublish hides it again.</li>
          <li>Use the arrows in each list to set the order shown on the site.</li>
          <li>Images: JPEG, PNG or WebP up to 15 MB. Diagrams are kept at full resolution; thumbnails are generated automatically.</li>
        </ul>
      </section>
    </div>
  );
}
