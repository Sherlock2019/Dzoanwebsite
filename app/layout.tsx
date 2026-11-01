import type { Metadata, Viewport } from "next";
import { Open_Sans, Raleway } from "next/font/google";
import { getProfile } from "@/lib/content";
import { siteUrl } from "@/lib/config";
import { thumbUrl } from "@/lib/media-url";
import "./globals.css";

const body = Open_Sans({ subsets: ["latin", "vietnamese"], variable: "--font-body", display: "swap" });
const heading = Raleway({ subsets: ["latin", "vietnamese"], variable: "--font-heading", display: "swap" });

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const p = await getProfile();
  const title = p.seo_title || [p.name, p.headline].filter(Boolean).join(" — ");
  const description = p.seo_description || p.value_proposition || p.tagline;
  const image = p.image ? thumbUrl(p.image) : undefined;
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: title, template: `%s | ${p.name}` },
    description,
    openGraph: {
      type: "profile",
      title,
      description,
      siteName: p.name,
      images: image ? [{ url: image, alt: `Portrait of ${p.name}` }] : undefined,
    },
    twitter: { card: "summary", title, description },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = { themeColor: "#040b14", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${body.variable} ${heading.variable}`}>{children}</body>
    </html>
  );
}
