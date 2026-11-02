import type { Metadata } from "next";
import ResetPasswordForm from "@/components/admin/ResetPasswordForm";
import { isResetTokenValid } from "@/lib/auth/reset";
import "../admin.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Reset owner password",
  robots: { index: false, follow: false },
  // Keep the one-time token out of Referer headers.
  referrer: "no-referrer",
};

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  return (
    <main className="login-page">
      <ResetPasswordForm token={token} valid={await isResetTokenValid(token)} />
    </main>
  );
}
