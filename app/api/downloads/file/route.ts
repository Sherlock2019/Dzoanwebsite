import { getProfile } from "@/lib/content";
import { logLead, notifyOwner, readDownloadToken } from "@/lib/gated";
import { findDownload } from "@/lib/gated-items";
import { getStorage } from "@/lib/storage/index";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Step 3: a short-lived signed link (issued after the email was confirmed) streams the file.

export async function GET(req: Request) {
  const token = readDownloadToken(new URL(req.url).searchParams.get("t"));
  if (!token) return new Response("This download link has expired. Please go back to the site and click Download again.", { status: 410 });
  const found = await findDownload(token.pid, token.i);
  if (!found) return new Response("Not found", { status: 404 });
  const file = await (await getStorage()).get(found.file.key);
  if (!file) return new Response("Not found", { status: 404 });

  const lead = { name: token.name, email: token.email, company: token.company, project: found.project.title, file: found.file.filename };
  await logLead({ type: "download", ...lead });
  getProfile()
    .then((p) => notifyOwner(p.name, lead))
    .catch((e) => console.error("gated download: owner notification failed:", (e as Error).message));

  return new Response(new Uint8Array(file.body), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(file.body.length),
      "Content-Disposition": `attachment; filename="${found.file.filename.replace(/["\\\r\n]/g, "")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
