import { SESSION_COOKIE } from "@/lib/auth/session";
import { COLLECTIONS } from "@/lib/types";

// OpenAPI 3.1 description of the site's HTTP API, rendered by Swagger UI at /api-docs.
// Keep it in step with app/api/**/route.ts when routes change.

const json = (schema: object = { type: "object" }) => ({ content: { "application/json": { schema } } });
const ok = (description = "OK", schema?: object) => ({ description, ...(schema ? json(schema) : {}) });
const error = { $ref: "#/components/responses/Error" };
const owner = [{ ownerSession: [] }];
const uuid = (name = "id") => ({ name, in: "path", required: true, schema: { type: "string", format: "uuid" } });
const collection = { name: "collection", in: "path", required: true, schema: { type: "string", enum: COLLECTIONS } };
const multipart = (properties: object, required: string[]) => ({
  required: true,
  content: { "multipart/form-data": { schema: { type: "object", properties, required } } },
});

export function openApiSpec(serverUrl: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "Portfolio API",
      version: "1.0.0",
      description:
        "HTTP API of the portfolio website. Owner routes need the session cookie set by `POST /api/auth/login` " +
        "(sign in at /admin first, then use *Try it out* here). Writes must come from the same origin.",
    },
    servers: [{ url: serverUrl }],
    tags: [
      { name: "Auth" },
      { name: "Public" },
      { name: "Content", description: "Owner-only content management" },
      { name: "AI documents", description: "Owner-only document ingestion (RAG) and AI-proposed site updates" },
    ],
    components: {
      securitySchemes: { ownerSession: { type: "apiKey", in: "cookie", name: SESSION_COOKIE } },
      schemas: {
        Error: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
        ChatMessage: {
          type: "object",
          properties: { role: { type: "string", enum: ["user", "assistant"] }, content: { type: "string", minLength: 1, maxLength: 2000 } },
          required: ["role", "content"],
        },
      },
      responses: { Error: { description: "Error", ...json({ $ref: "#/components/schemas/Error" }) } },
    },
    paths: {
      "/api/auth/login": {
        post: {
          tags: ["Auth"],
          summary: "Owner sign-in (sets the session cookie)",
          requestBody: json({
            type: "object",
            properties: { email: { type: "string", format: "email" }, password: { type: "string", format: "password" } },
            required: ["email", "password"],
          }),
          responses: { 200: ok("Signed in"), 401: error, 429: error, 503: error },
        },
      },
      "/api/auth/logout": { post: { tags: ["Auth"], summary: "Sign out", responses: { 200: ok() } } },
      "/api/chat": {
        post: {
          tags: ["Public"],
          summary: "Recruiter chat (Claude). Streams the answer as plain text",
          description: "Rate-limited: 20 questions per visitor per 10 minutes, plus a daily cap. 404 when the chat is disabled.",
          requestBody: json({
            type: "object",
            properties: { messages: { type: "array", minItems: 1, maxItems: 12, items: { $ref: "#/components/schemas/ChatMessage" } } },
            required: ["messages"],
          }),
          responses: {
            200: { description: "Streamed answer", content: { "text/plain": { schema: { type: "string" } } } },
            400: error,
            403: error,
            404: error,
            429: error,
          },
        },
      },
      "/media/{key}": {
        get: {
          tags: ["Public"],
          summary: "Serve an uploaded file (public only when published content references it)",
          parameters: [{ name: "key", in: "path", required: true, schema: { type: "string" }, example: "images/2026/<uuid>.webp" }],
          responses: { 200: { description: "File" }, 404: { description: "Not found" } },
        },
      },
      "/api/admin/profile": {
        get: { tags: ["Content"], summary: "Get the profile", security: owner, responses: { 200: ok(), 401: error } },
        put: { tags: ["Content"], summary: "Replace the profile", security: owner, requestBody: json(), responses: { 200: ok(), 401: error, 422: error } },
      },
      "/api/admin/{collection}": {
        get: { tags: ["Content"], summary: "List items", security: owner, parameters: [collection], responses: { 200: ok("Items", { type: "array", items: { type: "object" } }), 401: error, 404: error } },
        post: { tags: ["Content"], summary: "Create an item", security: owner, parameters: [collection], requestBody: json(), responses: { 201: ok("Created"), 400: error, 401: error, 422: error } },
      },
      "/api/admin/{collection}/{id}": {
        get: { tags: ["Content"], summary: "Get an item", security: owner, parameters: [collection, { name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: ok(), 401: error, 404: error } },
        put: { tags: ["Content"], summary: "Update an item", security: owner, parameters: [collection, { name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: json(), responses: { 200: ok(), 401: error, 404: error, 422: error } },
        delete: { tags: ["Content"], summary: "Delete an item (and its orphaned files)", security: owner, parameters: [collection, { name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: ok(), 401: error, 404: error } },
      },
      "/api/admin/{collection}/reorder": {
        post: {
          tags: ["Content"],
          summary: "Set the display order",
          security: owner,
          parameters: [collection],
          requestBody: json({ type: "object", properties: { ids: { type: "array", items: { type: "string" }, maxItems: 500 } }, required: ["ids"] }),
          responses: { 200: ok(), 400: error, 401: error },
        },
      },
      "/api/admin/upload": {
        post: {
          tags: ["Content"],
          summary: "Upload an image (JPEG/PNG/WebP) or the résumé PDF, up to 15 MB",
          security: owner,
          requestBody: multipart(
            { file: { type: "string", format: "binary" }, kind: { type: "string", enum: ["image", "pdf"] }, alt: { type: "string" } },
            ["file", "kind"],
          ),
          responses: { 201: ok("Stored"), 400: error, 401: error, 413: error, 415: error },
        },
      },
      "/api/admin/ai/status": {
        get: { tags: ["AI documents"], summary: "Status of the RAG database, Ollama, Flowise and the chat", security: owner, responses: { 200: ok(), 401: error } },
      },
      "/api/admin/ai/documents": {
        get: { tags: ["AI documents"], summary: "List uploaded documents", security: owner, responses: { 200: ok(), 401: error, 503: error } },
        post: {
          tags: ["AI documents"],
          summary: "Upload documents (PDF, DOCX, TXT, MD; 20 MB each, 5 per request); processed in the background",
          security: owner,
          requestBody: multipart({ file: { type: "array", items: { type: "string", format: "binary" } } }, ["file"]),
          responses: { 201: ok("Created"), 400: error, 401: error, 413: error, 415: error, 503: error },
        },
      },
      "/api/admin/ai/documents/{id}": {
        patch: {
          tags: ["AI documents"],
          summary: "Rename, or allow/disallow the public chat to quote it",
          security: owner,
          parameters: [uuid()],
          requestBody: json({ type: "object", properties: { public: { type: "boolean" }, title: { type: "string", maxLength: 200 } } }),
          responses: { 200: ok(), 400: error, 401: error, 404: error },
        },
        delete: { tags: ["AI documents"], summary: "Delete a document and its search index", security: owner, parameters: [uuid()], responses: { 200: ok(), 401: error, 404: error } },
      },
      "/api/admin/ai/documents/{id}/analyze": {
        post: { tags: ["AI documents"], summary: "Start AI analysis (Flowise or Qwen); proposals land in the AI Inbox", security: owner, parameters: [uuid()], responses: { 202: ok("Started"), 401: error, 404: error, 409: error } },
      },
      "/api/admin/ai/documents/{id}/file": {
        get: { tags: ["AI documents"], summary: "Download the original file", security: owner, parameters: [uuid()], responses: { 200: { description: "File" }, 401: error, 404: { description: "Not found" } } },
      },
      "/api/admin/ai/proposals": {
        get: {
          tags: ["AI documents"],
          summary: "List AI proposals",
          security: owner,
          parameters: [{ name: "status", in: "query", schema: { type: "string", enum: ["pending", "all"], default: "pending" } }],
          responses: { 200: ok(), 401: error },
        },
      },
      "/api/admin/ai/proposals/{id}": {
        post: {
          tags: ["AI documents"],
          summary: "Apply (optionally with an edited value) or reject a proposal",
          security: owner,
          parameters: [uuid()],
          requestBody: json({ type: "object", properties: { action: { type: "string", enum: ["apply", "reject"] }, value: {} }, required: ["action"] }),
          responses: { 200: ok(), 400: error, 401: error, 409: error, 422: error },
        },
      },
    },
  };
}
