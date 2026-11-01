import { notFound } from "next/navigation";
import EntityForm from "@/components/admin/EntityForm";
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
  return <EntityForm key={id} collection={collection} initial={item as never} refs={refs} />;
}
