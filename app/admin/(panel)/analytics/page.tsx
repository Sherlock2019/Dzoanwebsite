import Heatmap from "@/components/admin/Heatmap";
import TrackingLinkMaker from "@/components/admin/TrackingLinkMaker";
import { buildReport, readEvents } from "@/lib/analytics";
import { getRepo } from "@/lib/db/index";

export const dynamic = "force-dynamic";

const RANGES = [7, 30, 90];

const SECTION_LABELS: Record<string, string> = {
  home: "Top of page",
  about: "About",
  skills: "Skills",
  stacks: "Business & Human Stack",
  resume: "Résumé",
  projects: "Projects",
  architectures: "Architectures",
  current: "Current Projects",
  certifications: "Certifications",
  contact: "Contact",
};

function fmtDur(sec: number) {
  const s = Math.round(sec);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ${s % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

function fmtTime(ts: number) {
  return new Date(ts).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";
}

function CountList({ title, rows, empty }: { title: string; rows: { key: string; n: number }[]; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <section className="admin-fieldset an-card">
      <h2>{title}</h2>
      {rows.length ? (
        <ul className="an-bars">
          {rows.map((r) => (
            <li key={r.key}>
              <span className="an-bar-label" title={r.key}>
                {r.key}
              </span>
              <span className="an-bar-track" aria-hidden>
                <span style={{ width: `${(r.n / max) * 100}%` }} />
              </span>
              <span className="an-bar-value">{r.n}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint">{empty}</p>
      )}
    </section>
  );
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { days: raw } = await searchParams;
  const days = RANGES.includes(Number(raw)) ? Number(raw) : 30;
  const since = Date.now() - days * 86_400_000;
  const [events, sections] = await Promise.all([readEvents(since), (await getRepo()).list("sections")]);
  const r = buildReport(events, days);

  const labels: Record<string, string> = { ...SECTION_LABELS };
  for (const s of sections) labels[s.slug] = s.title;
  const label = (id: string) => labels[id] || id;
  const topSections = (secs: Record<string, number>) =>
    Object.entries(secs)
      .filter(([, n]) => n >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([id, n]) => `${label(id)} (${fmtDur(n)})`)
      .join(", ");

  const maxDay = Math.max(1, ...r.daily.map((d) => d.n));
  const paths = [...new Set(r.clicks.map((c) => c.path))];

  return (
    <div className="analytics">
      <div className="admin-form-head">
        <div>
          <h1>Visitors &amp; heatmap</h1>
          <p className="hint">Self-hosted and cookie-free. Your own visits while signed in are not counted. Times are UTC.</p>
        </div>
        <nav className="an-range" aria-label="Time range">
          {RANGES.map((d) => (
            <a key={d} href={`?days=${d}`} className={`btn btn-sm ${d === days ? "btn-primary" : "btn-outline"}`} aria-current={d === days ? "page" : undefined}>
              {d} days
            </a>
          ))}
        </nav>
      </div>

      <ul className="an-tiles">
        <li>
          <strong>{r.totals.visitors}</strong>
          <span>Visitors</span>
        </li>
        <li>
          <strong>{r.totals.visits}</strong>
          <span>Visits</span>
        </li>
        <li>
          <strong>{r.totals.pageviews}</strong>
          <span>Page views</span>
        </li>
        <li>
          <strong>{fmtDur(r.totals.avgDur)}</strong>
          <span>Avg. time on site</span>
        </li>
        <li>
          <strong>{r.totals.fileOpens}</strong>
          <span>Documents opened</span>
        </li>
      </ul>

      <section className="admin-fieldset">
        <h2>Visits per day</h2>
        <div className="an-daily" role="img" aria-label={`Visits per day over the last ${days} days`}>
          {r.daily.map((d) => (
            <div key={d.day} className="an-day" title={`${d.day}: ${d.n} visit${d.n === 1 ? "" : "s"}`}>
              <span style={{ height: `${(d.n / maxDay) * 100}%` }} />
            </div>
          ))}
        </div>
        <div className="an-daily-axis hint">
          <span>{r.daily[0]?.day}</span>
          <span>peak {maxDay === 1 && !r.daily.some((d) => d.n) ? 0 : maxDay} / day</span>
          <span>{r.daily[r.daily.length - 1]?.day}</span>
        </div>
      </section>

      <section className="admin-fieldset">
        <h2>Tracking links: who viewed your site</h2>
        <p className="hint">
          Send each company or recruiter their own link. When they open it, their visits show up here by name, with
          the sections they read and the documents they opened.
        </p>
        <TrackingLinkMaker />
        {r.refs.length ? (
          <div className="an-table-wrap">
            <table className="an-table">
              <thead>
                <tr>
                  <th>Link</th>
                  <th>Visits</th>
                  <th>Last visit</th>
                  <th>Time spent</th>
                  <th>Read most</th>
                  <th>Opened</th>
                </tr>
              </thead>
              <tbody>
                {r.refs.map((x) => (
                  <tr key={x.ref}>
                    <td>
                      <strong>{x.ref}</strong>
                    </td>
                    <td>{x.visits}</td>
                    <td>{fmtTime(x.last)}</td>
                    <td>{fmtDur(x.dur)}</td>
                    <td>{topSections(x.secs) || "—"}</td>
                    <td>{x.files.join(", ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="hint">No tracking-link visits in this period yet.</p>
        )}
      </section>

      <section className="admin-fieldset">
        <h2>How far people read</h2>
        <p className="hint">Share of home-page visits that spent at least 2 seconds on each section, and the average time there.</p>
        {r.sections.length ? (
          <ul className="an-bars">
            {r.sections.map((s) => (
              <li key={s.id}>
                <span className="an-bar-label">{label(s.id)}</span>
                <span className="an-bar-track" aria-hidden>
                  <span style={{ width: `${s.reach * 100}%` }} />
                </span>
                <span className="an-bar-value">
                  {Math.round(s.reach * 100)}% · {fmtDur(s.avg)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">No data yet.</p>
        )}
      </section>

      <section className="admin-fieldset">
        <h2>Click heatmap</h2>
        <p className="hint">Where visitors clicked, drawn over the live page. Hotter colours mean more clicks.</p>
        <Heatmap clicks={r.clicks} paths={paths.length ? paths : ["/"]} />
      </section>

      <div className="an-grid">
        <CountList title="Documents opened" rows={r.files} empty="No documents opened yet." />
        <CountList title="Where visitors came from" rows={r.sources} empty="No visits yet." />
        <CountList title="Country / browser language" rows={r.places} empty="No visits yet." />
        <CountList title="Devices" rows={r.devices} empty="No visits yet." />
        <CountList title="Pages" rows={r.pages} empty="No visits yet." />
      </div>

      <section className="admin-fieldset">
        <h2>Recent visits</h2>
        {r.recent.length ? (
          <div className="an-table-wrap">
            <table className="an-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Link</th>
                  <th>From</th>
                  <th>Where</th>
                  <th>Device</th>
                  <th>Time</th>
                  <th>Read most</th>
                  <th>Opened</th>
                </tr>
              </thead>
              <tbody>
                {r.recent.map((s) => (
                  <tr key={s.sid}>
                    <td>{fmtTime(s.start)}</td>
                    <td>{s.ref ? <strong>{s.ref}</strong> : "—"}</td>
                    <td>{s.src || "Direct"}</td>
                    <td>{s.where || "—"}</td>
                    <td>{s.dev}</td>
                    <td>{fmtDur(s.dur)}</td>
                    <td>{topSections(s.secs) || "—"}</td>
                    <td>{s.files.join(", ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="hint">No visits in this period yet.</p>
        )}
      </section>
    </div>
  );
}
