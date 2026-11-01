"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { LuArrowDown, LuArrowUp, LuExternalLink, LuPencil, LuPlus, LuTrash2 } from "react-icons/lu";
import { COLLECTION_CONFIG } from "@/lib/admin/collections";
import { thumbUrl } from "@/lib/media-url";
import { formatDate } from "@/lib/text";
import type { CollectionName, Media } from "@/lib/types";
import { api } from "./api";

type Row = Record<string, unknown> & { id: string; visibility: string; updated_at: string; slug?: string };

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

  const hasMedia = ["projects", "architectures", "current"].includes(collection);

  return (
    <div>
      <div className="admin-form-head">
        <div>
          <h1>{config.label}</h1>
          <p className="hint">{config.description}</p>
        </div>
        <a className="btn btn-primary" href={`/admin/${collection}/new`}>
          <LuPlus aria-hidden /> New {config.singular}
        </a>
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
            const groupOf = (r: Row) => String((config.groupField && r[config.groupField]) || "").trim() || "No group";
            const showGroup = Boolean(config.groupField) && (i === 0 || groupOf(rows[i - 1]) !== groupOf(row));
            return (
              <Fragment key={row.id}>
              {showGroup && (
                <li className="admin-group-heading" aria-hidden={false}>
                  {groupOf(row)}
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
        </ul>
      )}
    </div>
  );
}
