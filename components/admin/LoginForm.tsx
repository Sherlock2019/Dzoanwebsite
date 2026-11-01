"use client";

import Link from "next/link";
import { useState } from "react";
import { LuLock } from "react-icons/lu";

export default function LoginForm({ configured }: { configured: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      window.location.href = "/admin";
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(data.error || "Sign-in failed");
    setBusy(false);
  }

  return (
    <form className="login-card" onSubmit={submit}>
      <h1>
        <LuLock aria-hidden /> Owner sign-in
      </h1>
      {!configured && (
        <p className="admin-message error" role="alert">
          Sign-in is not configured on this server. Set OWNER_EMAIL, OWNER_PASSWORD_HASH and SESSION_SECRET (see README).
        </p>
      )}
      <label htmlFor="email" className="admin-label">
        Email
      </label>
      <input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <label htmlFor="password" className="admin-label">
        Password
      </label>
      <input
        id="password"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary" disabled={busy || !configured}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <p className="hint">
        <Link href="/">← Back to the portfolio</Link>
      </p>
    </form>
  );
}
