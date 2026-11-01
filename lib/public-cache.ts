import { cache } from "react";
import { getPublicContent } from "@/lib/content";

/** Per-request memoised public content (layout and page share one read). */
export const loadPublicContent = cache(getPublicContent);
