import { notFound } from "next/navigation";
import EntityForm from "@/components/admin/EntityForm";
import { COLLECTION_CONFIG } from "@/lib/admin/collections";
import { getRepo } from "@/lib/db/index";
import { isCollection } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditPage({ params }: { params: Promise<{ collection: string; id: string }> }) {
  const { collection, id } = await params;
  if (!isCollection(collection)) notFound();
  const repo = await getRepo();
  const item = id === "new" ? null : await repo.get(collection, id);
  if (id !== "new" && !item) notFound();
  const [projects, architectures] = await Promise.all([repo.list("projects"), repo.list("architectures")]);
  const refs = {
    projects: projects.map((p) => ({ id: p.id, title: p.title })),
    architectures: architectures.map((a) => ({ id: a.id, title: a.title })),
  };
  // Values already used for "suggest existing" fields (e.g. project group names), in list order.
  const existing: Record<string, string[]> = {};
  const all = (await repo.list(collection)) as unknown as Record<string, unknown>[];
  for (const field of COLLECTION_CONFIG[collection].fields.filter((f) => f.suggestExisting)) {
    existing[field.name] = [...new Set(all.map((x) => String(x[field.name] || "").trim()).filter(Boolean))];
  }
  return <EntityForm key={id} collection={collection} initial={item as never} refs={refs} existing={existing} />;
}
