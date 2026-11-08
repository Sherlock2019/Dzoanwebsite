import { cookies } from "next/headers";
import { getRepo } from "@/lib/db/index";
import { readVerified, VERIFIED_COOKIE } from "@/lib/gated";
import type { Attachment, CurrentProject } from "@/lib/types";

/** A published project's gated file, or null. */
export async function findDownload(pid: unknown, index: unknown): Promise<{ project: CurrentProject; file: Attachment } | null> {
  if (typeof pid !== "string" || !Number.isInteger(index)) return null;
  const project = await (await getRepo()).get("current", pid);
  if (!project || project.visibility !== "published") return null;
  const file = (project.downloads || [])[index as number];
  return file ? { project, file } : null;
}

export async function verifiedVisitor() {
  return readVerified((await cookies()).get(VERIFIED_COOKIE)?.value);
}
