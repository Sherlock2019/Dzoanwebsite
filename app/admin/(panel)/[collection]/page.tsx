import { notFound } from "next/navigation";
import EntityList from "@/components/admin/EntityList";
import { getRepo } from "@/lib/db/index";
import { isCollection } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CollectionPage({ params }: { params: Promise<{ collection: string }> }) {
  const { collection } = await params;
  if (!isCollection(collection)) notFound();
  const items = await (await getRepo()).list(collection);
  return <EntityList key={collection} collection={collection} initial={items as never} />;
}
