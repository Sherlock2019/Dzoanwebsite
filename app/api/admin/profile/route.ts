import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/guard";
import { getProfile, saveProfile } from "@/lib/content";
import { formatIssues, profileSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await requireOwner(req);
  if (denied) return denied;
  return NextResponse.json(await getProfile());
}

export async function PUT(req: Request) {
  const denied = await requireOwner(req);
  if (denied) return denied;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please fix the highlighted fields", issues: formatIssues(parsed.error) }, { status: 422 });
  }
  // The slide 1 background is managed on its own page (/api/admin/background): keep the stored one,
  // so saving the profile form can never overwrite a newer background choice.
  const current = await getProfile();
  return NextResponse.json(await saveProfile({ ...parsed.data, slide1_bg: current.slide1_bg }));
}
