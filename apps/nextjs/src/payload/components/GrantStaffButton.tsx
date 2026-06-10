"use client";

import { useState } from "react";

/** cms.users doc id from /admin/collections/users/<id>. */
function docIdFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const m = /\/admin\/collections\/users\/([^/?#]+)/.exec(
    window.location.pathname,
  );
  const id = m?.[1];
  return id && id !== "create" ? id : null;
}

/**
 * Grant CMS admin (staff) access to an existing, already-mirrored user — flags
 * `profiles.is_staff = true` via the staff-only /api/cms/grant-staff endpoint.
 * For brand-new emails, "Users → Create New" still emails an invite instead.
 */
export function GrantStaffButton() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function grant() {
    const docId = docIdFromUrl();
    if (!docId) {
      setMessage("Save the user first.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/cms/grant-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId, grant: true }),
      });
      const data = (await res.json()) as { error?: string };
      setMessage(res.ok ? "Staff access granted." : (data.error ?? "Failed."));
    } catch {
      setMessage("Failed — check your connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="field-type" style={{ marginBottom: "1rem" }}>
      <button
        type="button"
        className="btn btn--style-secondary btn--size-small"
        disabled={busy}
        onClick={() => void grant()}
      >
        <span className="btn__content">
          <span className="btn__label">
            {busy ? "Granting…" : "Grant staff access"}
          </span>
        </span>
      </button>
      {message ? (
        <p style={{ fontSize: "0.8rem", opacity: 0.8, marginTop: "0.4rem" }}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
