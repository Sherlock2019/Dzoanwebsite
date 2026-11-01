import { existsSync } from "fs";
import path from "path";

/** Load .env.local / .env for CLI scripts (Next.js loads them itself for the app). */
export function loadEnv(): void {
  for (const name of [".env.local", ".env"]) {
    const file = path.resolve(process.cwd(), name);
    if (existsSync(file)) process.loadEnvFile(file);
  }
}
