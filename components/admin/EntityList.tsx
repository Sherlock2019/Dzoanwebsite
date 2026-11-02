"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { LuArrowDown, LuArrowUp, LuExternalLink, LuFolderPlus, LuPencil, LuPlus, LuTrash2 } from "react-icons/lu";
import { COLLECTION_CONFIG } from "@/lib/admin/collections";
import { thumbUrl } from "@/lib/media-url";
import { formatDate } from "@/lib/text";
import type { CollectionName, Media } from "@/lib/types";
import { api } from "./api";

type Row = Record<string, unknown> & { id: string; visibility: string; updated_at: string; slug?: string };

/** Value of the "＋ New group…" menu entry (group names are trimmed, so this can't clash with one). */
const NEW_GROUP = " new-group ";

function coverOf(row: Row): Media | null {
  const media = (row.media as Media[] | undefined)?.[0] || (row.image as Media | null) || (row.diagrams as Media[] | undefined)?.[0];
  return media ?? null;
}

export default function EntityList({ collection, initial }: { collection: CollectionName; initial: Row[] }) {
  const config = COLLECTION_CONFIG[collection];
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const move = (i: number, d: number) =>
    run(async () => {
      const next = [...rows];
      [next[i], next[i + d]] = [next[i + d], next[i]];
      setRows(next);
      await api(`/api/admin/${collection}/reorder`, { method: "POST", body: JSON.stringify({ ids: next.map((r) => r.id) }) });
    });

  const toggle = (row: Row) =>
    run(async () => {
      const visibility = row.visibility === "published" ? "draft" : "published";
      const saved = await api<Row>(`/api/admin/${collection}/${row.id}`, { method: "PUT", body: JSON.stringify({ ...row, visibility }) });
      setRows((rs) => rs.map((r) => (r.id === row.id ? saved : r)));
    });

  const remove = (row: Row) => {
    const title = String(row[config.titleField] || "this item");
    if (!window.confirm(`Delete “${title}” permanently? Its uploaded images are removed too. This cannot be undone.`)) return;
    run(async () => {
      await api(`/api/admin/${collection}/${row.id}`, { method: "DELETE" });
      setRows((rs) => rs.filter((r) => r.id !== row.id));
    });
  };

  // Groups exist only as values on items. A new group stays listed here (empty) until something is moved into it.
  const groupField = config.groupField;
  const [newGroups, setNewGroups] = useState<string[]>([]);
  const groupKey = (r: Row) => String((groupField && r[groupField]) || "").trim();
  const usedGroups = [...new Set(rows.map(groupKey))];
  const emptyGroups = newGroups.filter((g) => !usedGroups.includes(g));
  const allGroups = [...usedGroups, ...emptyGroups];
  const groupLabel = (g: string) => g || "No group";

  function askGroupName(): string | null {
    const name = window.prompt("Name of the new group (e.g. Live AI Demos):")?.trim().slice(0, 80);
    if (!name) return null;
    const existing = allGroups.find((g) => g.toLowerCase() === name.toLowerCase());
    if (existing === undefined) setNewGroups((gs) => [...gs, name]);
    return existing ?? name;
  }

  /** Save the item's new group and place it last in that group, so each group stays together. */
  const moveToGroup = (row: Row, group: string) => {
    if (!groupField || group === groupKey(row)) return;
    run(async () => {
      const saved = await api<Row>(`/api/admin/${collection}/${row.id}`, {
        method: "PUT",
        body: JSON.stringify({ ...row, [groupField]: group }),
      });
      const others = rows.filter((r) => r.id !== row.id);
      const lastInGroup = others.map(groupKey).lastIndexOf(group);
      const next = [...others];
      next.splice(lastInGroup === -1 ? next.length : lastInGroup + 1, 0, saved);
      setRows(next);
      await api(`/api/admin/${collection}/reorder`, { method: "POST", body: JSON.stringify({ ids: next.map((r) => r.id) }) });
    });
  };

  const hasMedia = ["projects", "architectures", "current"].includes(collection);

  return (
    <div>
      <div className="admin-form-head">
        <div>
          <h1>{config.label}</h1>
          <p className="hint">{config.description}</p>
        </div>
        <div className="admin-head-actions">
          {groupField && (
            <button type="button" className="btn btn-outline" disabled={busy} onClick={askGroupName}>
              <LuFolderPlus aria-hidden /> New group
            </button>
          )}
          <a className="btn btn-primary" href={`/admin/${collection}/new`}>
            <LuPlus aria-hidden /> New {config.singular}
          </a>
        </div>
      </div>
      {error && (
        <p className="admin-message error" role="alert">
          {error}
        </p>
      )}
      {rows.length === 0 ? (
        <p className="empty-note">Nothing here yet.</p>
      ) : (
        <ul className="admin-list" aria-busy={busy}>
          {rows.map((row, i) => {
            const cover = hasMedia ? coverOf(row) : null;
            const published = row.visibility === "published";
            const showGroup = Boolean(groupField) && (i === 0 || groupKey(rows[i - 1]) !== groupKey(row));
            return (
              <Fragment key={row.id}>
              {showGroup && (
                <li className="admin-group-heading" aria-hidden={false}>
                  {groupLabel(groupKey(row))}
                </li>
              )}
              <li>
                {hasMedia && (
                  <div className="admin-list-thumb">{cover ? <img src={thumbUrl(cover)} alt="" /> : <span aria-hidden>—</span>}</div>
                )}
                <div className="admin-list-main">
                  <a href={`/admin/${collection}/${row.id}`} className="admin-list-title">
                    {String(row[config.titleField] || "Untitled")}
                  </a>
                  <p className="hint">
                    <span className={`badge ${published ? "tone-green" : "tone-amber"}`}>{published ? "Published" : "Draft"}</span>{" "}
                    {config.subtitleField && String(row[config.subtitleField] || "")} · updated {formatDate(row.updated_at)}
                  </p>
                </div>
                <div className="admin-list-actions">
                  {groupField && (
                    <select
                      className="admin-group-select"
                      aria-label={`Group of ${String(row[config.titleField] || "this item")}`}
                      title="Move to another group"
                      disabled={busy}
                      value={groupKey(row)}
                      onChange={(e) => {
                        const group = e.target.value === NEW_GROUP ? askGroupName() : e.target.value;
                        if (group !== null) moveToGroup(row, group);
                      }}
                    >
                      {allGroups.map((g) => (
                        <option key={g} value={g}>
                          {groupLabel(g)}
                        </option>
                      ))}
                      {!allGroups.includes("") && <option value="">No group</option>}
                      <option value={NEW_GROUP}>＋ New group…</option>
                    </select>
                  )}
                  <button type="button" className="icon-btn" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label="Move up">
                    <LuArrowUp aria-hidden />
                  </button>
                  <button type="button" className="icon-btn" disabled={busy || i === rows.length - 1} onClick={() => move(i, 1)} aria-label="Move down">
                    <LuArrowDown aria-hidden />
                  </button>
                  <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => toggle(row)}>
                    {published ? "Unpublish" : "Publish"}
                  </button>
                  {published && config.publicPath && row.slug && (
                    <a className="icon-btn" href={`/${config.publicPath}/${row.slug}`} target="_blank" rel="noopener noreferrer" aria-label="View on site">
                      <LuExternalLink aria-hidden />
                    </a>
                  )}
                  <a className="icon-btn" href={`/admin/${collection}/${row.id}`} aria-label="Edit">
                    <LuPencil aria-hidden />
                  </a>
                  <button type="button" className="icon-btn danger" disabled={busy} onClick={() => remove(row)} aria-label="Delete">
                    <LuTrash2 aria-hidden />
                  </button>
                </div>
              </li>
              </Fragment>
            );
          })}
          {emptyGroups.map((g) => (
            <Fragment key={`new-group-${g}`}>
              <li className="admin-group-heading">{g}</li>
              <li className="admin-group-empty hint">
                Empty — pick “{g}” in a {config.singular}&apos;s group menu to move it here.
              </li>
            </Fragment>
          ))}
        </ul>
      )}
    </div>
  );
}
