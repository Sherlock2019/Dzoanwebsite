import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Next.js injects inline bootstrap scripts, so 'unsafe-inline' is needed for scripts without a nonce setup.
// Everything else (images, media, API calls) is same-origin only.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "frame-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["sharp", "pg", "mammoth", "unpdf"],
  async headers() {
    const headers = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];
    if (isProd) headers.push({ key: "Content-Security-Policy", value: csp });
    return [{ source: "/(.*)", headers }];
  },
};

export default nextConfig;
