import { promises as fs } from "fs";
import path from "path";
import { dataDir } from "@/lib/config";
import { contentTypeForKey, isValidKey, type ObjectStorage } from "./index";

// Files live under DATA_DIR/uploads. Keys are validated against a strict pattern and the
// resolved path is checked to stay inside the uploads root (no path traversal).

export function createLocalStorage(root = path.join(dataDir(), "uploads")): ObjectStorage {
  function resolve(key: string): string {
    if (!isValidKey(key)) throw new Error("Invalid storage key");
    const full = path.resolve(root, key);
    if (!full.startsWith(path.resolve(root) + path.sep)) throw new Error("Invalid storage key");
    return full;
  }

  return {
    async put(key, body) {
      const full = resolve(key);
      await fs.mkdir(path.dirname(full), { recursive: true });
      const tmp = `${full}.tmp`;
      await fs.writeFile(tmp, body);
      await fs.rename(tmp, full);
    },
    async get(key) {
      try {
        const body = await fs.readFile(resolve(key));
        return { body, contentType: contentTypeForKey(key) };
      } catch {
        return null;
      }
    },
    async remove(keys) {
      for (const key of keys) {
        try {
          await fs.unlink(resolve(key));
        } catch {
          // already gone
        }
      }
    },
  };
}
