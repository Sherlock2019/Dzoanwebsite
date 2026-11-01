import { getOwnerSession } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Swagger UI for the site's API, served from the site itself so "Try it out" runs same-origin
// with the owner's session. Owner-only; assets come from the swagger-ui-dist package.

const PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>API docs · Portfolio</title>
  <link rel="icon" href="/api-docs/assets/favicon-32x32.png">
  <link rel="stylesheet" href="/api-docs/assets/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="/api-docs/assets/swagger-ui-bundle.js"></script>
  <script src="/api-docs/assets/swagger-ui-standalone-preset.js"></script>
  <script src="/api-docs/assets/init.js"></script>
</body>
</html>`;

export async function GET(req: Request) {
  if (!(await getOwnerSession())) return Response.redirect(new URL("/admin/login", req.url), 303);
  return new Response(PAGE, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" },
  });
}
