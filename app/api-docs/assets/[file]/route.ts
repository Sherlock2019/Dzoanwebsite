import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

// Static Swagger UI files from node_modules/swagger-ui-dist (fixed allow-list, no user paths).
const FILES: Record<string, string> = {
  "swagger-ui.css": "text/css; charset=utf-8",
  "swagger-ui-bundle.js": "text/javascript; charset=utf-8",
  "swagger-ui-standalone-preset.js": "text/javascript; charset=utf-8",
  "favicon-32x32.png": "image/png",
};

const INIT = `window.ui = SwaggerUIBundle({
  url: "/api/openapi.json",
  dom_id: "#swagger-ui",
  deepLinking: true,
  withCredentials: true,
  presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
  layout: "StandaloneLayout",
});`;

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const headers = { "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff" };
  if (file === "init.js") return new Response(INIT, { headers: { ...headers, "Content-Type": "text/javascript; charset=utf-8" } });
  const type = FILES[file];
  if (!type) return new Response("Not found", { status: 404 });
  const body = await readFile(path.join(process.cwd(), "node_modules", "swagger-ui-dist", file));
  return new Response(new Uint8Array(body), { headers: { ...headers, "Content-Type": type } });
}
