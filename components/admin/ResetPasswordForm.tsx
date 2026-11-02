"use client";

import Link from "next/link";
import { useState } from "react";
import { LuKeyRound } from "react-icons/lu";

export default function ResetPasswordForm({ token, valid }: { token: string; valid: boolean }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("The two passwords don't match");
      return;
    }
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/reset/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    if (res.ok) {
      setDone(true);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Password reset failed");
    }
    setBusy(false);
  }

  if (done) {
    return (
      <div className="login-card">
        <h1>
          <LuKeyRound aria-hidden /> Password changed
        </h1>
        <p className="admin-message ok" role="status">
          Your new password is active. Save it in your password manager.
        </p>
        <Link href="/admin/login" className="btn btn-primary">
          Sign in
        </Link>
      </div>
    );
  }

  if (!valid) {
    return (
      <div className="login-card">
        <h1>
          <LuKeyRound aria-hidden /> Reset password
        </h1>
        <p className="admin-message error" role="alert">
          This reset link is invalid or has expired. Request a new one from the sign-in page.
        </p>
        <Link href="/admin/login" className="btn btn-outline">
          Back to sign-in
        </Link>
      </div>
    );
  }

  return (
    <form className="login-card" onSubmit={submit}>
      <h1>
        <LuKeyRound aria-hidden /> Set a new password
      </h1>
      <label htmlFor="new-password" className="admin-label">
        New password
      </label>
      <input
        id="new-password"
        type="password"
        autoComplete="new-password"
        minLength={12}
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <label htmlFor="confirm-password" className="admin-label">
        Repeat new password
      </label>
      <input
        id="confirm-password"
        type="password"
        autoComplete="new-password"
        minLength={12}
        required
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />
      <p className="hint">At least 12 characters. All signed-in sessions will be signed out.</p>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? "Saving…" : "Save new password"}
      </button>
      <p className="hint">
        <Link href="/admin/login">← Back to sign-in</Link>
      </p>
    </form>
  );
}
