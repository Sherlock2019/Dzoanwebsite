# Dzoan Nguyen Tran — portfolio

A Next.js 15 + TypeScript portfolio with an owner-only dashboard. Every section can be edited, uploaded or replaced
without touching code: profile, photo, résumé PDF, skills, experience, projects, architecture diagrams, current
projects and certifications.

- Public site: fixed dark sidebar, About, Skills + Business/Human stack, Résumé timeline, filterable project and
  architecture galleries, a zoomable diagram viewer, Current Projects, Certifications and Contact.
- Owner dashboard (`/admin`): create, edit, publish, unpublish, reorder and delete content; upload images and the PDF.

## Quick start (local)

```bash
cd ~/Myweb
./start.sh          # installs, configures, seeds and builds on first run, then serves the site
./start.sh --bg     # same, in the background (survives closing the terminal / SSH)
./start.sh --dev    # development mode with hot reload
./stop.sh           # stop it
PORT=4000 ./start.sh
```

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

`content/seed/assets/` (the résumé PDF and full-resolution diagrams) is git-ignored. Keep it on this machine.

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

## Signing in as the owner

Open the dashboard address printed by `start.sh` (e.g. **http://localhost:3100/admin**) and sign in with `OWNER_EMAIL` and your password. Visitors never see an edit
button. When you are signed in, an **Admin / Edit** link appears at the bottom of the sidebar.

- Change the password: `npm run hash-password -- 'new long password'`, then paste the output into `OWNER_PASSWORD_HASH`
  and restart.
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
