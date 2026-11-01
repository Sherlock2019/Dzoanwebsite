import { randomBytes } from "crypto";
import { existsSync, writeFileSync } from "fs";
import path from "path";
import { hashPassword } from "@/lib/auth/password";

// Usage: npm run setup -- you@example.com
// Creates .env.local for local development with a random owner password (printed once),
// its hash and a random session secret. Refuses to overwrite an existing .env.local.

async function main() {
  const email = (process.argv[2] || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error("Usage: npm run setup -- you@example.com");
    process.exit(1);
  }
  const file = path.resolve(process.cwd(), ".env.local");
  if (existsSync(file)) {
    console.error(".env.local already exists — edit it, or delete it to start over.");
    process.exit(1);
  }
  const password = randomBytes(15).toString("base64url");
  const env = [
    "# Local development settings (git-ignored). See .env.example for all options.",
    `OWNER_EMAIL=${email}`,
    `OWNER_PASSWORD_HASH=${await hashPassword(password)}`,
    `SESSION_SECRET=${randomBytes(48).toString("base64url")}`,
    "SESSION_TTL_HOURS=72",
    "SITE_URL=http://localhost:3100",
    "DATA_PROVIDER=local",
    "DATA_DIR=./.data",
    "",
  ].join("\n");
  writeFileSync(file, env, { mode: 0o600 });
  console.log("Created .env.local");
  console.log(`Owner email:    ${email}`);
  console.log(`Owner password: ${password}`);
  console.log("Store this password in your password manager now — it is not saved anywhere.");
  console.log("To change it later: npm run hash-password -- 'new-password' and update OWNER_PASSWORD_HASH.");
}

main();
