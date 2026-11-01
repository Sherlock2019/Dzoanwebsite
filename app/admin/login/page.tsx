import type { Metadata } from "next";
import { redirect } from "next/navigation";
import LoginForm from "@/components/admin/LoginForm";
import { getOwnerSession } from "@/lib/auth/guard";
import { authConfigured } from "@/lib/config";
import "../admin.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Owner sign-in", robots: { index: false, follow: false } };

export default async function LoginPage() {
  if (await getOwnerSession()) redirect("/admin");
  return (
    <main className="login-page">
      <LoginForm configured={authConfigured()} />
    </main>
  );
}
