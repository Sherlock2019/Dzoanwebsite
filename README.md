# Dzoan Nguyen Tran — portfolio

A Next.js 15 + TypeScript portfolio with an owner-only dashboard. Every section can be edited, uploaded or replaced
without touching code: profile, photo, résumé PDF, skills, experience, projects, architecture diagrams, current
projects and certifications.

- Public site: fixed dark sidebar, About, Skills + Business/Human stack, Résumé timeline, filterable project and
  architecture galleries, a zoomable diagram viewer, Current Projects, Certifications and Contact.
- Owner dashboard (`/admin`): create, edit, publish, unpublish, reorder and delete content; upload images and the PDF.
- AI: a recruiter chat (Claude), document upload with hybrid search (RAG), and AI-proposed site updates that you
  approve (Qwen through Ollama, optionally orchestrated by Flowise).
- API docs: Swagger UI at `/api-docs`.

## Architecture

```mermaid
flowchart LR
  visitor(["Visitor / recruiter"])
  owner(["Owner"])

  subgraph next["Next.js 15 app (./start.sh, port 3100)"]
    direction TB
    site["Public site<br/>About · Projects · Architectures · Résumé"]
    chatw["Chat widget"]
    admin["Owner dashboard /admin<br/>content editor · AI & documents"]
    docs["Swagger UI /api-docs<br/>+ /api/openapi.json"]
    subgraph api["API routes"]
      chatapi["/api/chat<br/>rate limit · same-origin"]
      adminapi["/api/admin/*<br/>owner session · zod validation"]
      aiapi["/api/admin/ai/*<br/>documents · analyze · proposals"]
      media["/media/*<br/>published files only"]
    end
    subgraph libs["Server libraries"]
      content["lib/content + lib/db<br/>Repository"]
      storage["lib/storage<br/>ObjectStorage"]
      rag["lib/rag<br/>parse · chunk · embed · hybrid search"]
      analyze["lib/ai/analyze + proposals<br/>evidence check · approval"]
      ctx["lib/ai/site-context<br/>published content only"]
    end
  end

  subgraph data["Content storage (DATA_PROVIDER)"]
    local[(".data/db.json + uploads<br/>local, default")]
    supa[("Supabase Postgres + Storage<br/>optional")]
  end

  subgraph docker["Docker (started by ./start.sh)"]
    pg[("rag-db: Postgres + pgvector<br/>127.0.0.1:55434")]
    flowise["Flowise<br/>:3110 · UI + /api/v1"]
  end

  ollama["Ollama :11434<br/>embeddinggemma · qwen2.5:7b"]
  claude["Anthropic API<br/>Claude Haiku 5.5"]

  visitor --> site & chatw
  chatw --> chatapi
  owner --> admin & docs
  admin --> adminapi & aiapi
  docs -. try it out .-> api
  site --> media
  chatapi --> ctx & rag
  chatapi -- streaming, cached prompt --> claude
  adminapi --> content & storage
  aiapi --> rag & analyze
  ctx & analyze --> content
  content --> local & supa
  storage --> local & supa
  media --> storage
  rag --> pg
  rag -- embeddings --> ollama
  analyze --> pg
  analyze -- chatflow, when configured --> flowise
  analyze -- otherwise direct --> ollama
  flowise -- ChatOllama --> ollama
  flowise -- own "flowise" database --> pg
```

Every AI piece is optional: without Docker, Ollama or an Anthropic key the matching feature switches off and the
rest of the site keeps working (see [AI features](#ai-features)).

## Quick start (local)

```bash
cd ~/Myweb
./start.sh          # installs, configures, seeds and builds on first run, then serves the site
./start.sh --bg     # same, in the background (survives closing the terminal / SSH)
./start.sh --dev    # development mode with hot reload
./stop.sh           # stop it (./stop.sh --all also stops the Docker services)
PORT=4000 ./start.sh
FLOWISE=0 ./start.sh   # don't start Flowise
```

Everything starts together, and `start.sh` prints the links:

| Service | Link (local defaults) | Notes |
|---|---|---|
| Website | http://localhost:3100 | Public site |
| Owner dashboard | http://localhost:3100/admin | AI & documents page has *Open Flowise* / *Open Swagger* buttons |
| API docs (Swagger UI) | http://localhost:3100/api-docs | Owner sign-in required; spec at `/api/openapi.json` |
| Flowise (UI + backend) | http://localhost:3110 | REST API under `/api/v1`; health: `/api/v1/ping`. Docker service `flowise` |
| Analysis chatflow API | `POST http://localhost:3110/api/v1/prediction/5f0c2d7e-…` | Installed by `start.sh`; see AI features |
| Document database | `127.0.0.1:55434` | Docker service `rag-db` (Postgres + pgvector), localhost only |
| Ollama | http://127.0.0.1:11434 | Installed separately (see AI features) |

The launcher starts at port 3100 (or `PORT`). If that port is busy, it uses the next free one and prints the
address. It listens on all interfaces (`BIND=127.0.0.1` restricts it to this machine).

On the first run, `start.sh` creates `.env.local` for `OWNER_EMAIL` (default: dzoannguyentran@gmail.com) and saves a
one-time password in `.data/OWNER_PASSWORD.txt`. Copy it to your password manager, then delete that file.

Manual steps, if you prefer:

```bash
npm install
npm run setup -- you@example.com   # creates .env.local and prints a one-time owner password
npm run seed                       # loads content/seed/seed.json + content/seed/assets/
npm run build && npm start         # http://localhost:3100
```

`content/seed/assets/` (the résumé PDF and full-resolution diagrams) and the live content in `.data/` are committed.
The repository is public, so everything in them is downloadable from GitHub. Keep drafts and private files out.

## Running on AWS EC2

1. **Copy the folder.** Your content and uploads in `.data/` come with it; `node_modules` and `.next` are rebuilt there:
   ```bash
   rsync -av --exclude node_modules --exclude .next ~/Myweb/ ec2-user@<PUBLIC_IP>:~/Myweb/
   ```
   (Use `ubuntu@` on Ubuntu AMIs. Add `-e "ssh -i key.pem"` if you use a key file.)
2. **Start it:**
   ```bash
   ssh ec2-user@<PUBLIC_IP>
   cd ~/Myweb && ./start.sh --bg
   ```
   The launcher installs Node.js 22 if needed (nvm, no sudo). It reinstalls dependencies for the instance's CPU
   (x86 or Graviton/ARM), finds a free port and reads the instance's **public IP** from EC2 metadata. It then prints
   `http://<PUBLIC_IP>:<port>`.
3. **Open the port.** In the instance's security group, add an inbound rule for TCP on the printed port (e.g. 3100).
   Allow it from "My IP" while you test.
4. **Use HTTPS before signing in remotely.** Over plain `http://` the owner password is sent unencrypted. With a
   domain pointing at the instance, the simplest option is Caddy:
   ```bash
   sudo caddy reverse-proxy --from your.domain --to localhost:3100   # automatic Let's Encrypt certificate
   PUBLIC_URL=https://your.domain BIND=127.0.0.1 ./start.sh --bg
   ```
   Then open ports 80/443 in the security group and close 3100.
5. **Small instances** (under 2 GB RAM, e.g. t3.micro): the build may run out of memory. Add swap once:
   `sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile`.
6. **Restart after reboot.** Run `./start.sh --bg` again, or add `@reboot cd ~/Myweb && ./start.sh --bg` with
   `crontab -e`.

Overrides: `PUBLIC_HOST=1.2.3.4` (if metadata is unavailable), `PUBLIC_URL=https://…` (domain / HTTPS) and `PORT=…`.

### One command: https://dzoannguyentran.jobsmatchnow.com

On the EC2, `./startaws.sh` does steps 2–4 for the jobsmatchnow.com subdomain. It is safe to re-run.

1. **DNS:** it checks that the GoDaddy A record `dzoannguyentran` → the instance's public IP is live. With
   `GODADDY_API_KEY`/`GODADDY_API_SECRET` set, it creates the record itself; otherwise it prints the record and waits.
2. **Website:** it starts the site in the background on `127.0.0.1:9065` (or the next free port if another program has it — the proxy follows), reachable only through the proxy.
3. **Proxy and HTTPS:** it adds the subdomain to the web server already on port 80 (nginx: a `conf.d` file plus a
   certbot certificate; Caddy: a Caddyfile block). If neither is installed, it installs nginx.
4. **Check:** it fetches the HTTPS URL.

The security group needs ports 80 and 443 open. Close 9065 afterwards. Options: `SUBDOMAIN`, `DOMAIN`, `PORT`, `CERT_EMAIL`.
After `git pull` or a reboot, re-run `./startaws.sh`. Plain `./start.sh` would use port 3100 instead of 9065.

**Content travels with git.** The site content (`.data/db.json`, `.data/uploads/`) and the seed assets are
committed, so a clone is the complete website. Edit on the PC, commit and push, then on the EC2 run
`git pull && ./startaws.sh`. Edits made in the EC2's admin change `.data/db.json` there: commit them
from the EC2, or `git checkout .data` before pulling, or the pull refuses to overwrite them.
AI documents (the pgvector index) are not in git; upload them again in the AI Inbox.

**sudo asks for a password.** Stock EC2 Ubuntu has password-less sudo for `ubuntu`. If yours asks for a password you
don't know, restore it in one of these ways:
- **Session Manager:** in the AWS console, go to EC2 → instance → Connect → *Session Manager*. Its `ssm-user` has
  password-less sudo. Then run:
  `echo 'ubuntu ALL=(ALL) NOPASSWD:ALL' | sudo tee /etc/sudoers.d/90-cloud-init-users`
- **Docker group:** if `groups` lists `docker`, Docker can write the same file:
  `docker run --rm -v /etc/sudoers.d:/s alpine sh -c "echo 'ubuntu ALL=(ALL) NOPASSWD:ALL' > /s/90-cloud-init-users && chmod 440 /s/90-cloud-init-users"`
- **Neither works:** stop the instance, attach its root volume to another instance, and fix the file there.

## Signing in as the owner

Open the dashboard address printed by `start.sh` (e.g. **http://localhost:3100/admin**) and sign in with `OWNER_EMAIL` and your password. Visitors never see an edit
button. When you are signed in, an **Admin / Edit** link appears at the bottom of the sidebar.

- Change the password: `npm run hash-password -- 'new long password'`, then paste the output into `OWNER_PASSWORD_HASH`
  and restart.
- Forgot the password: press **Forgot password? Reset it** on the sign-in page. A one-time link (valid 30 minutes) is
  written to `.data/PASSWORD_RESET_LINK.txt` on the server — open it to set a new password. The new hash is kept in
  `.data/owner-password.json` and signs out all other sessions; setting a new `OWNER_PASSWORD_HASH` later takes precedence.
- Sign out of all devices: change `SESSION_SECRET` and restart.

## Editing content

| Task | Where |
|---|---|
| Photo, name, headline, bio, links, résumé PDF, headline numbers, phone toggle | Dashboard → Profile & résumé |
| Add a project with several screenshots | Projects → New project → Add images (the first image is the card cover) → Save & publish |
| Add an architecture diagram | Architectures → New → Upload image → choose Type/status and tags → Save & publish |
| Post a current-project update | Current projects → New → stage, objective, screenshots, links, date → Save & publish |
| Reorder anything | Use the ↑ ↓ arrows in each list |
| Hide something | Unpublish it. Drafts and their images return 404 to visitors |

Images: JPEG, PNG or WebP up to 15 MB. Originals are kept byte-for-byte so diagram labels stay readable, and a WebP
thumbnail is generated for the galleries. Architecture images can be downloaded only when you tick *Allow download*.

## Data & hosting

`DATA_PROVIDER` selects the storage backend (see `.env.example`):

- **`local`** (default): `DATA_DIR/db.json` plus `DATA_DIR/uploads/`. Writes are atomic. This is durable across
  refreshes, devices and restarts, **as long as `DATA_DIR` is on a persistent disk or volume**, e.g. a VM or a Docker
  volume. It is **not** durable on serverless or ephemeral hosts such as Vercel. Back up `DATA_DIR`.
- **`supabase`**: Postgres tables plus a private Storage bucket.
  1. Create a Supabase project and run `supabase/migrations/0001_init.sql` in the SQL editor.
  2. Set `DATA_PROVIDER=supabase`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server only) and `SUPABASE_BUCKET`.
  3. `npm run seed`, then deploy.
  **This adapter has not been tested against a live Supabase project yet.** Run `npm run smoke` against it before
  going live.

The data layer sits behind `lib/db` (`Repository`) and `lib/storage` (`ObjectStorage`). To use another database or
object store, add one adapter for each.

## AI features

All optional. Each one switches off cleanly when its service isn't configured, and the site works without any of
them. Settings are in `.env.example`; the dashboard page **AI & documents** shows what is connected.

| Feature | Needs | Without it |
|---|---|---|
| Document upload, search index and AI Inbox | `RAG_DATABASE_URL` (Postgres + pgvector) | The AI page shows only the status panel |
| Vector search (embeddings) | Ollama with `EMBED_MODEL` (default `embeddinggemma`, 768 dimensions) | Keyword search only |
| Document analysis → proposed site updates | Ollama with `ANALYZE_MODEL` (default `qwen2.5:7b`), or a Flowise chatflow | Analyze fails with a message; documents stay searchable |
| Public recruiter chat | `ANTHROPIC_API_KEY` (model `CHAT_MODEL`, default `claude-haiku-5-5`) | The chat button is hidden |

**Document database.** When Docker is available, `./start.sh` generates `RAG_DB_PASSWORD` and `RAG_DATABASE_URL` in
`.env.local` and starts the `rag-db` service from `docker-compose.yml` (pgvector, localhost port 55434, data in the
`myweb-rag-data` volume). The tables are created on first use. To run it by hand:
`docker compose --env-file .env.local up -d rag-db`.

**Local models.** Install [Ollama](https://ollama.com), then `ollama pull embeddinggemma && ollama pull qwen2.5:7b`.
Analysis runs Qwen with a 16k-token context and sends at most the first 32,000 characters of a document; the
dashboard says when a document was longer. If you change `EMBED_MODEL` to one with a different vector size, update
`embedDimensions` in `lib/ai/config.ts` and recreate the `rag_chunks` table.

**Flowise (optional).** `./start.sh` runs Flowise in Docker on port 3110 (`FLOWISE_PORT`) and sets
`FLOWISE_URL`. It uses host networking so it can reach Ollama at `http://127.0.0.1:11434`. Its chatflows and
accounts are stored in a separate `flowise` database on `rag-db` (created by `start.sh`), and its keys and files in
the `myweb-flowise-data` volume. On the first visit Flowise asks you to create its admin account.

The analysis chatflow ships with the repo ([flowise/portfolio-document-analyzer.json](flowise/portfolio-document-analyzer.json)):
ChatOllama (`qwen2.5:7b`, temperature 0.2, context 16384, JSON mode) → LLM Chain ← Prompt Template `{question}`.
Once the Flowise account exists, `./start.sh` installs it as **Portfolio document analyzer** (via
`scripts/flowise-setup.sh`) and sets `FLOWISE_CHATFLOW_ID`, so *Analyze* runs through Flowise. Its API:

```bash
curl -X POST http://localhost:3110/api/v1/prediction/5f0c2d7e-3b1a-4c55-9d1e-6a2f8b7c4e01 \
  -H 'Content-Type: application/json' -d '{"question": "…"}'
```

The site sends the whole prompt (instructions, current site, document) as `question`. To use your own flow instead,
set `FLOWISE_CHATFLOW_ID` (and `FLOWISE_API_KEY` if the flow is protected) and restart; the setup script keeps a
custom ID. Flowise also shows the endpoint for any flow under the `</>` (API Endpoint) button. On EC2, Flowise listens on all interfaces: keep port 3110 closed in
the security group and use an SSH tunnel (`ssh -L 3110:localhost:3110 …`).

**How it works.**

1. Dashboard → AI & documents → *Upload documents* (PDF, .docx, .txt, .md; 20 MB each). Originals are stored privately
   under `sources/` and are only downloadable by the owner. The text is extracted, chunked, embedded and indexed.
2. *Analyze* compares the document with the current site and fills the **AI Inbox** with proposals (profile text,
   project fields, new projects, roles, certifications, skills). Each one must quote the document word for word;
   proposals whose quote isn't in the document are discarded automatically.
3. Review each proposal, edit it if needed, then *Apply* or *Reject*. Updates to existing content go live at once;
   new projects, roles and certifications are created as drafts. Nothing changes without your approval.
4. Tick *Chatbot can use* on a document to let the public chat quote it. Documents are private by default.

**Recruiter chat.** Claude answers only from published content (drafts never reach it) plus excerpts from documents
marked *Chatbot can use*. Limits: 20 questions per visitor per 10 minutes and `CHAT_DAILY_LIMIT` per day (default
1000), counted per server process. The portfolio part of the prompt is cached, so repeat questions are cheap; token
use is logged as `[chat] … in (+… cached), … out`. Set `CHAT_ENABLED=false` to hide the chat.

## Security model

- Owner auth runs on the server: an scrypt password hash, and an HMAC-signed session in an HttpOnly, `SameSite=Strict`
  cookie. Sign-in attempts are throttled.
- Every dashboard page checks the session on the server. Every admin API route checks it again on its own, and also
  blocks cross-origin writes. Hiding buttons is not relied on.
- Input is validated with zod on the server. Unknown fields are dropped. URLs must be `http(s)`. Text is rendered as
  text, never as HTML.
- Uploads: the file type is detected from the bytes (SVG, HTML and executables are rejected). MIME type and size are
  checked, images are decoded with sharp, and storage keys are generated by the server (no user filenames, no path
  traversal).
- All files go through `/media/...`. A file is public only if published content references it, so draft files stay
  private. Orphaned files are deleted when content is removed.
- Supabase: RLS is on for all tables. Anonymous clients can only read published rows and can never write. The profile
  table has no public policy.
- AI: every AI admin route is owner-only. Uploaded documents are detected by their bytes, never published, and served
  only to the owner. AI proposals are validated against a fixed schema and go through the normal content validation
  when applied. The chat API checks the origin, is rate-limited, and only sees published content.
- API docs: `/api-docs` and `/api/openapi.json` are owner-only; Swagger UI is served from the site itself (no CDN).
- Security headers include CSP, `X-Frame-Options: DENY` and `nosniff`. Secrets live only in environment variables.

## Tests

```bash
npm run typecheck && npm run lint && npm test   # unit tests (auth, validation, uploads, draft privacy)
OWNER_EMAIL=… OWNER_PASSWORD=… npm run smoke     # end-to-end against a running server (creates and removes test data)
```

## Deploying (not done; only when you decide)

On a VM, for example the existing demo host: `npm ci && npm run build`, set the environment variables (with
`SITE_URL=https://your-domain`), keep `DATA_DIR` on persistent disk, run `npm start` behind HTTPS (nginx/Caddy), and
back up `DATA_DIR`.

Before publishing, review `content/review-notes.md`.
