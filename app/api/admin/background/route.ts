import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/guard";
import { getProfile, saveProfile } from "@/lib/content";
import { formatIssues, profileSchema, slide1BgSettingsSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Slide 1 background settings (owner only). Public pages read them from the profile. */
export async function GET(req: Request) {
  const denied = await requireOwner(req);
  if (denied) return denied;
  return NextResponse.json((await getProfile()).slide1_bg);
}

/** Publish new slide 1 background settings (owner only); only this part of the profile changes. */
export async function PUT(req: Request) {
  const denied = await requireOwner(req);
  if (denied) return denied;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = slide1BgSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please fix the highlighted fields", issues: formatIssues(parsed.error) }, { status: 422 });
  }
  const current = await getProfile();
  const full = profileSchema.safeParse({ ...current, slide1_bg: parsed.data });
  if (!full.success) {
    return NextResponse.json({ error: "Could not save the profile", issues: formatIssues(full.error) }, { status: 422 });
  }
  const saved = await saveProfile(full.data);
  return NextResponse.json(saved.slide1_bg);
}
