// End-to-end acceptance checks against a running server.
//   BASE_URL=http://localhost:3100 OWNER_EMAIL=… OWNER_PASSWORD=… npm run smoke
// Creates temporary content, verifies access rules and persistence, then deletes it again.

import sharp from "sharp";

const BASE = process.env.BASE_URL || "http://localhost:3100";
const EMAIL = process.env.OWNER_EMAIL;
const PASSWORD = process.env.OWNER_PASSWORD;
const PHASE = process.argv[2] || "all"; // "all" | "before-restart" | "after-restart"

let passed = 0;
let failed = 0;
function check(name, ok, detail = "") {
  if (ok) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const ORIGIN = { Origin: BASE };
async function req(path, { cookie, method = "GET", json, form, headers = {}, redirect = "manual" } = {}) {
  const h = { ...headers };
  if (cookie) h.Cookie = cookie;
  if (method !== "GET") Object.assign(h, ORIGIN, headers);
  let body;
  if (json !== undefined) {
    h["Content-Type"] = "application/json";
    body = JSON.stringify(json);
  } else if (form) body = form;
  return fetch(BASE + path, { method, headers: h, body, redirect });
}

async function login() {
  const res = await req("/api/auth/login", { method: "POST", json: { email: EMAIL, password: PASSWORD } });
  const set = res.headers.get("set-cookie") || "";
  return { res, cookie: set.split(";")[0] };
}

async function png(color, w = 1400, h = 900) {
  return sharp({ create: { width: w, height: h, channels: 3, background: color } }).png().toBuffer();
}

async function upload(cookie, buf, type, name, kind = "image") {
  const form = new FormData();
  form.set("file", new Blob([buf], { type }), name);
  form.set("kind", kind);
  return req("/api/admin/upload", { cookie, method: "POST", form });
}

async function publicChecks() {
  console.log("\nPublic site");
  const home = await req("/");
  const html = await home.text();
  check("home page renders (200)", home.status === 200, String(home.status));
  for (const id of ["home", "about", "skills", "stacks", "resume", "projects", "architectures", "certifications", "contact"]) {
    check(`section #${id} present and linked in sidebar`, html.includes(`id="${id}"`) && html.includes(`href="/#${id}"`));
  }
  check("name and headline shown", html.includes("Dzoan Nguyen Tran") && html.includes("AI / ML &amp; Multi-Cloud Solutions Architect"));
  const phoneShown = html.includes("84908618075");
  check(
    "phone: hidden, or published with WhatsApp + call links",
    !phoneShown || (html.includes('href="https://wa.me/84908618075"') && html.includes('href="tel:+84908618075"')),
  );
  check("invitation + email contact on Home", html.includes("Tell me what you do") && html.includes('href="mailto:dzoannguyentran@gmail.com"'));
  check("security headers set", home.headers.get("x-frame-options") === "DENY" && Boolean(home.headers.get("content-security-policy")));
  check("SEO metadata present", html.includes('<meta property="og:title"') && html.includes('name="description"'));

  const project = await req("/projects/banking-ai-copilot-credit-and-asset-appraisal");
  const projectHtml = await project.text();
  check("project detail page renders", project.status === 200);
  check("project demo links to correct URL, opens safely", projectHtml.includes('href="http://100.31.100.157:8080" target="_blank" rel="noopener noreferrer"'));
  check("project shows POC status, not production", projectHtml.includes(">POC<"));

  const archMatch = html.match(/href="\/architectures\/([a-z0-9-]+)"/);
  const arch = await req(`/architectures/${archMatch?.[1]}`);
  const archHtml = await arch.text();
  check("architecture detail page renders", arch.status === 200);
  const imgMatch = archHtml.match(/src="(\/media\/images\/[^"?]+\.png)"/);
  const img = imgMatch ? await req(imgMatch[1]) : null;
  check("published diagram served at full resolution", img?.status === 200 && img.headers.get("content-type") === "image/png");
  check("architecture diagrams have alt text", /<img[^>]+alt="[^"]{10,}"[^>]+src="\/media\/images/.test(archHtml) || /src="\/media\/images[^"]+"[^>]*alt="[^"]{10,}"/.test(archHtml));

  const pdfMatch = html.match(/href="(\/media\/documents\/[^"?]+\.pdf)"/);
  const pdf = pdfMatch ? await req(pdfMatch[1]) : null;
  check("résumé PDF opens inline", pdf?.status === 200 && pdf.headers.get("content-type") === "application/pdf");
  const dl = pdfMatch ? await req(`${pdfMatch[1]}?download=1`) : null;
  check("résumé PDF downloads", (dl?.headers.get("content-disposition") || "").startsWith("attachment"));

  check("unknown slug returns 404", (await req("/projects/does-not-exist")).status === 404);
  check("path traversal in media is rejected", (await req("/media/..%2F..%2F.env.local")).status === 404);
}

async function unauthorizedChecks() {
  console.log("\nUnauthorised access");
  const admin = await req("/admin");
  check("/admin redirects to sign-in", [302, 307].includes(admin.status) && (admin.headers.get("location") || "").includes("/admin/login"));
  check("GET admin API → 401", (await req("/api/admin/projects")).status === 401);
  check("GET profile API → 401", (await req("/api/admin/profile")).status === 401);
  check("create → 401", (await req("/api/admin/projects", { method: "POST", json: { title: "x" } })).status === 401);
  check("update → 401", (await req("/api/admin/projects/abc", { method: "PUT", json: { title: "x" } })).status === 401);
  check("delete → 401", (await req("/api/admin/projects/abc", { method: "DELETE" })).status === 401);
  check("upload → 401", (await upload(null, await png("#000", 10, 10), "image/png", "x.png")).status === 401);
  check("forged cookie → 401", (await req("/api/admin/projects", { cookie: "pf_owner=eyJzdWIiOiJ4In0.forged" })).status === 401);
  const bad = await req("/api/auth/login", { method: "POST", json: { email: EMAIL, password: "wrong-password-123" } });
  check("wrong password rejected", bad.status === 401);
}

async function ownerFlow() {
  console.log("\nOwner workflows");
  const { res, cookie } = await login();
  check("owner can sign in", res.ok && cookie.startsWith("pf_owner="));
  const setCookie = res.headers.get("set-cookie") || "";
  check("session cookie is HttpOnly + SameSite=Strict", /HttpOnly/i.test(setCookie) && /SameSite=Strict/i.test(setCookie));

  const cross = await fetch(`${BASE}/api/admin/projects`, {
    method: "POST",
    headers: { Cookie: cookie, Origin: "https://evil.example", "Content-Type": "application/json" },
    body: JSON.stringify({ title: "x" }),
  });
  check("cross-origin write blocked even with cookie", cross.status === 403);

  // Malicious uploads
  const svg = await upload(cookie, Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"), "image/png", "evil.png");
  check("SVG disguised as PNG rejected", svg.status === 415);
  const html = await upload(cookie, Buffer.from("<html><script>alert(1)</script></html>"), "text/html", "x.html");
  check("HTML upload rejected", html.status === 415);
  const exe = await upload(cookie, Buffer.from([0x4d, 0x5a, 0x90, 0, 3, 0]), "application/pdf", "x.pdf", "pdf");
  check("executable disguised as PDF rejected", exe.status === 415);

  // Profile image upload + replace. The real photo/banner are parked in a hidden draft first, so the
  // orphan cleanup (which deletes replaced files) can't remove them while the test swaps the photo.
  const profile = await (await req("/api/admin/profile", { cookie })).json();
  const keep = [profile.image, profile.hero_image].filter(Boolean);
  const holder = keep.length
    ? await (await req("/api/admin/projects", { cookie, method: "POST", json: { title: "Smoke keepalive", media: keep, visibility: "draft" } })).json()
    : null;
  const p1 = await (await upload(cookie, await png("#0563bb", 800, 1000), "image/png", "portrait.png")).json();
  const withImage = await req("/api/admin/profile", { cookie, method: "PUT", json: { ...profile, image: { ...p1, alt: "Portrait test" } } });
  check("owner uploads a profile image", withImage.ok && (await req(`/media/${p1.key}`)).status === 200);
  const p2 = await (await upload(cookie, await png("#149ddd", 800, 1000), "image/png", "portrait2.png")).json();
  await req("/api/admin/profile", { cookie, method: "PUT", json: { ...profile, image: { ...p2, alt: "Portrait test 2" } } });
  check("owner replaces the profile image (old file removed)", (await req(`/media/${p2.key}`)).status === 200 && (await req(`/media/${p1.key}`, { cookie })).status === 404);
  await req("/api/admin/profile", { cookie, method: "PUT", json: profile }); // restore
  check("removing the image deletes the file", (await req(`/media/${p2.key}`, { cookie })).status === 404);
  if (holder) await req(`/api/admin/projects/${holder.id}`, { cookie, method: "DELETE" });
  let kept = true;
  for (const m of keep) if ((await req(`/media/${m.key}`)).status !== 200) kept = false;
  check("real profile photo and banner untouched by the test", kept);

  // Project with multiple screenshots, as a draft
  const s1 = await (await upload(cookie, await png("#e11d48"), "image/png", "shot1.png")).json();
  const s2 = await (await upload(cookie, await png("#16a34a"), "image/png", "shot2.png")).json();
  check("multiple screenshots uploaded", Boolean(s1.key && s2.key && s1.thumb));
  const badLink = await req("/api/admin/projects", { cookie, method: "POST", json: { title: "Bad", demo_url: "javascript:alert(1)" } });
  check("javascript: URL rejected", badLink.status === 422);
  const created = await req("/api/admin/projects", {
    cookie,
    method: "POST",
    json: {
      title: "Smoke Test Project",
      summary: "Temporary item created by the smoke test.",
      status: "POC",
      categories: ["Other"],
      media: [
        { ...s1, alt: "Screenshot one" },
        { ...s2, alt: "Screenshot two" },
      ],
      links: [{ label: "Docs", url: "https://example.com/docs" }],
      visibility: "draft",
    },
  });
  const project = await created.json();
  check("owner creates a project (draft)", created.status === 201 && project.visibility === "draft");
  check("draft project hidden from public page", (await req(`/projects/${project.slug}`)).status === 404);
  check("draft screenshot hidden from public", (await req(`/media/${s1.key}`)).status === 404);
  check("owner can preview draft screenshot", (await req(`/media/${s1.key}`, { cookie })).status === 200);
  check("draft not listed on home page", !(await (await req("/")).text()).includes("Smoke Test Project"));

  const edited = await req(`/api/admin/projects/${project.id}`, { cookie, method: "PUT", json: { ...project, subtitle: "Edited", visibility: "published" } });
  check("owner edits and publishes the project", edited.ok);
  const pub = await req(`/projects/${project.slug}`);
  const pubHtml = await pub.text();
  check("published project visible with edits", pub.status === 200 && pubHtml.includes("Edited"));
  check("published screenshot visible", (await req(`/media/${s1.key}`)).status === 200);

  // Architecture
  const d = await (await upload(cookie, await png("#0b3d73", 3000, 1800), "image/png", "diagram.png")).json();
  const arch = await (
    await req("/api/admin/architectures", {
      cookie,
      method: "POST",
      json: { title: "Smoke Test Diagram", status: "Proposed Design", tags: ["AWS"], image: { ...d, alt: "Test diagram" }, related_project: project.id, visibility: "published" },
    })
  ).json();
  check("owner uploads and publishes an architecture diagram", (await req(`/architectures/${arch.slug}`)).status === 200);

  // Current project
  const c1 = await (await upload(cookie, await png("#f59e0b"), "image/png", "current.png")).json();
  const cur = await req("/api/admin/current", {
    cookie,
    method: "POST",
    json: {
      title: "Smoke Test Current",
      stage: "In Progress",
      summary: "Temporary current project.",
      media: [{ ...c1, alt: "Current screenshot" }],
      links: [{ label: "GitHub", url: "https://github.com/Sherlock2019" }],
      visibility: "published",
    },
  });
  const current = await cur.json();
  const home = await (await req("/")).text();
  check("owner adds a current project with screenshot and links", cur.status === 201 && home.includes('id="current"') && home.includes("Smoke Test Current"));

  return { cookie, project, arch, current, keys: [s1.key, s2.key, d.key, c1.key] };
}

async function persistenceAndCleanup(state) {
  console.log("\nPersistence & cleanup");
  const { cookie: fresh } = await login();
  const list = await (await req("/api/admin/projects", { cookie: fresh })).json();
  check("content visible from a separate sign-in session", list.some((p) => p.id === state.project.id));
  check("published content visible without any session", (await req(`/projects/${state.project.slug}`)).status === 200);

  const before = await (await req("/api/admin/projects", { cookie: fresh })).json();
  const ids = before.map((p) => p.id);
  const reordered = [state.project.id, ...ids.filter((i) => i !== state.project.id)];
  await req("/api/admin/projects/reorder", { cookie: fresh, method: "POST", json: { ids: reordered } });
  const after = await (await req("/api/admin/projects", { cookie: fresh })).json();
  check("owner reorders projects", after[0]?.id === state.project.id);
  await req("/api/admin/projects/reorder", { cookie: fresh, method: "POST", json: { ids } });

  for (const [c, item] of [["current", state.current], ["architectures", state.arch], ["projects", state.project]]) {
    const del = await req(`/api/admin/${c}/${item.id}`, { cookie: fresh, method: "DELETE" });
    check(`owner deletes the test ${c} item`, del.ok);
  }
  check("deleted project gone from public site", (await req(`/projects/${state.project.slug}`)).status === 404);
  let gone = true;
  for (const k of state.keys) if ((await req(`/media/${k}`, { cookie: fresh })).status !== 404) gone = false;
  check("uploaded files removed with their items", gone);

  const out = await req("/api/auth/logout", { cookie: fresh, method: "POST" });
  check("owner signs out (cookie cleared)", out.ok && /pf_owner=;/.test(out.headers.get("set-cookie") || ""));
}

const STATE_FILE = new URL("../.data/smoke-state.json", import.meta.url);

async function main() {
  if (!EMAIL || !PASSWORD) {
    console.error("Set OWNER_EMAIL and OWNER_PASSWORD");
    process.exit(2);
  }
  const fs = await import("fs");
  if (PHASE === "all" || PHASE === "before-restart") {
    await publicChecks();
    await unauthorizedChecks();
    const state = await ownerFlow();
    if (PHASE === "before-restart") {
      fs.writeFileSync(STATE_FILE, JSON.stringify({ ...state, cookie: undefined }));
      console.log("\nState saved — restart the server, then run: npm run smoke -- after-restart");
    } else {
      await persistenceAndCleanup(state);
    }
  } else if (PHASE === "after-restart") {
    const state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    console.log("\nAfter server restart");
    check("published project survived a server restart", (await req(`/projects/${state.project.slug}`)).status === 200);
    check("uploaded screenshot survived a server restart", (await req(`/media/${state.keys[0]}`)).status === 200);
    await persistenceAndCleanup(state);
    fs.unlinkSync(STATE_FILE);
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
