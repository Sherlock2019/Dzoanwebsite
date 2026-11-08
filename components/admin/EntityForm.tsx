"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LuExternalLink, LuSave, LuTrash2 } from "react-icons/lu";
import { COLLECTION_CONFIG, type Field } from "@/lib/admin/collections";
import type { CollectionName } from "@/lib/types";
import { api, ApiError } from "./api";
import { EntriesField, FilesField, ImageField, ImagesField, LinesInput, LinksField, RefSelect, RefsChecklist, TagsInput, type RefOption } from "./fields";

type Item = Record<string, unknown> & { id?: string; slug?: string; visibility?: string };

interface Props {
  collection: CollectionName;
  initial: Item | null;
  refs: { projects: RefOption[]; architectures: RefOption[] };
  /** Values already used per field in this collection, for suggestExisting fields. */
  existing?: Record<string, string[]>;
}

export default function EntityForm({ collection, initial, refs, existing = {} }: Props) {
  const config = COLLECTION_CONFIG[collection];
  const router = useRouter();
  const isNew = !initial?.id;
  const [item, setItem] = useState<Item>(initial ?? { ...config.defaults });
  const [issues, setIssues] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function set(name: string, value: unknown) {
    setItem((prev) => ({ ...prev, [name]: value }));
    setDirty(true);
  }

  async function save(visibility?: "published" | "draft") {
    setSaving(true);
    setMessage(null);
    setIssues({});
    const body = { ...item, ...(visibility ? { visibility } : {}) };
    try {
      const saved = await api<Item>(isNew ? `/api/admin/${collection}` : `/api/admin/${collection}/${item.id}`, {
        method: isNew ? "POST" : "PUT",
        body: JSON.stringify(body),
      });
      setItem(saved);
      setDirty(false);
      setMessage({ tone: "ok", text: saved.visibility === "published" ? "Saved and published." : "Saved as draft (not visible to visitors)." });
      if (isNew) router.replace(`/admin/${collection}/${saved.id}`);
      router.refresh();
    } catch (e) {
      const err = e as ApiError;
      setIssues(err.issues || {});
      setMessage({ tone: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    const title = String(item[config.titleField] || `this ${config.singular}`);
    if (!window.confirm(`Delete “${title}” permanently? Its uploaded images are removed too. This cannot be undone.`)) return;
    try {
      await api(`/api/admin/${collection}/${item.id}`, { method: "DELETE" });
      setDirty(false);
      router.push(`/admin/${collection}`);
      router.refresh();
    } catch (e) {
      setMessage({ tone: "error", text: (e as Error).message });
    }
  }

  function issueFor(name: string): string | undefined {
    const key = Object.keys(issues).find((k) => k === name || k.startsWith(`${name}.`));
    if (!key) return undefined;
    // Point at the entry and field for nested lists, e.g. "Entry 2, url: Must be a full https:// URL".
    const nested = key.slice(name.length + 1).match(/^(\d+)\.(\w+)/);
    return nested && name === "entries" ? `Entry ${Number(nested[1]) + 1}, ${nested[2]}: ${issues[key]}` : issues[key];
  }

  function renderField(field: Field) {
    const id = `f-${field.name}`;
    const value = item[field.name];
    switch (field.type) {
      case "textarea":
        return <textarea id={id} rows={field.rows || 4} value={String(value ?? "")} onChange={(e) => set(field.name, e.target.value)} />;
      case "select":
        return (
          <select id={id} value={String(value ?? "")} onChange={(e) => set(field.name, e.target.value)}>
            {field.options?.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        );
      case "multiselect": {
        const list = (value as string[]) || [];
        return (
          <div className="checklist" id={id}>
            {field.options?.map((o) => (
              <label key={o}>
                <input
                  type="checkbox"
                  checked={list.includes(o)}
                  onChange={(e) => set(field.name, e.target.checked ? [...list, o] : list.filter((x) => x !== o))}
                />
                {o}
              </label>
            ))}
          </div>
        );
      }
      case "checkbox":
        return (
          <label className="checkbox-line">
            <input id={id} type="checkbox" checked={Boolean(value)} onChange={(e) => set(field.name, e.target.checked)} />
            {field.label}
          </label>
        );
      case "tags":
        return <TagsInput id={id} value={(value as string[]) || []} onChange={(v) => set(field.name, v)} suggestions={field.suggestions} />;
      case "lines":
        return <LinesInput id={id} rows={field.rows} value={(value as string[]) || []} onChange={(v) => set(field.name, v)} />;
      case "image":
        return <ImageField id={id} value={(value as never) ?? null} onChange={(v) => set(field.name, v)} />;
      case "images":
        return <ImagesField id={id} value={(value as never) || []} onChange={(v) => set(field.name, v)} />;
      case "files":
        return <FilesField id={id} value={(value as never) || []} onChange={(v) => set(field.name, v)} />;
      case "links":
        return <LinksField id={id} value={(value as never) || []} onChange={(v) => set(field.name, v)} />;
      case "ref":
        return <RefSelect id={id} value={String(value ?? "")} onChange={(v) => set(field.name, v)} options={refs[field.collection!].filter((o) => o.id !== item.id)} />;
      case "refs":
        return <RefsChecklist value={(value as string[]) || []} onChange={(v) => set(field.name, v)} options={refs[field.collection!]} />;
      case "entries":
        return <EntriesField id={id} value={(value as never) || []} onChange={(v) => set(field.name, v)} />;
      default: {
        const suggestions = field.suggestExisting ? existing[field.name] || [] : [];
        return (
          <>
            <input
              id={id}
              type={field.type === "url" ? "url" : field.type === "email" ? "email" : field.type === "date" ? "date" : "text"}
              value={String(value ?? "")}
              required={field.required}
              list={suggestions.length ? `${id}-list` : undefined}
              onChange={(e) => set(field.name, e.target.value)}
            />
            {suggestions.length > 0 && (
              <>
                <datalist id={`${id}-list`}>
                  {suggestions.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
                <div className="tag-suggestions">
                  <span>Existing:</span>
                  {suggestions.map((s) => (
                    <button type="button" key={s} onClick={() => set(field.name, s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        );
      }
    }
  }

  const published = item.visibility === "published";

  return (
    <form
      className="admin-form"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="admin-form-head">
        <div>
          <p className="admin-breadcrumb">
            <a href={`/admin/${collection}`}>{config.label}</a> / {isNew ? `New ${config.singular}` : "Edit"}
          </p>
          <h1>{isNew ? `New ${config.singular}` : String(item[config.titleField] || "Untitled")}</h1>
          {!isNew && (
            <p>
              <span className={`badge ${published ? "tone-green" : "tone-amber"}`}>{published ? "Published" : "Draft"}</span>
              {published && config.publicPath && item.slug && (
                <a className="admin-view-link" href={`/${config.publicPath}/${item.slug}`} target="_blank" rel="noopener noreferrer">
                  View on site <LuExternalLink aria-hidden />
                </a>
              )}
            </p>
          )}
        </div>
        <div className="admin-form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            <LuSave aria-hidden /> {saving ? "Saving…" : "Save"}
          </button>
          {published ? (
            <button type="button" className="btn btn-outline" disabled={saving} onClick={() => save("draft")}>
              Unpublish
            </button>
          ) : (
            <button type="button" className="btn btn-outline" disabled={saving} onClick={() => save("published")}>
              Save &amp; publish
            </button>
          )}
        </div>
      </div>

      {message && (
        <p className={`admin-message ${message.tone}`} role={message.tone === "error" ? "alert" : "status"}>
          {message.text}
        </p>
      )}

      <div className="admin-fields">
        {config.fields.map((field) => {
          const error = issueFor(field.name);
          const wide = ["textarea", "images", "image", "links", "lines", "tags", "multiselect", "refs", "entries", "files"].includes(field.type);
          return (
            <div key={field.name} className={`admin-field${wide ? " is-wide" : ""}${error ? " has-error" : ""}`}>
              {field.type !== "checkbox" && (
                <label htmlFor={`f-${field.name}`} className="admin-label">
                  {field.label}
                  {field.required && <span aria-hidden> *</span>}
                </label>
              )}
              {renderField(field)}
              {field.help && <p className="hint">{field.help}</p>}
              {error && <p className="field-error">{error}</p>}
            </div>
          );
        })}
      </div>

      <div className="admin-form-foot">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          <LuSave aria-hidden /> {saving ? "Saving…" : "Save"}
        </button>
        {!isNew && (
          <button type="button" className="btn btn-danger" onClick={remove}>
            <LuTrash2 aria-hidden /> Delete
          </button>
        )}
      </div>
    </form>
  );
}
