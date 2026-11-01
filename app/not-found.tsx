import Link from "next/link";

export default function NotFound() {
  return (
    <main className="not-found">
      <h1>Page not found</h1>
      <p>This page doesn’t exist or isn’t published yet.</p>
      <Link className="btn btn-primary" href="/">
        Back to the portfolio
      </Link>
    </main>
  );
}
