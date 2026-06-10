"use client";

import { useState } from "react";

/**
 * Admin sidebar button (a Payload `ui` field on Plans/Coupons) that pushes the
 * current doc to Stripe via POST /api/stripe/sync, then reloads so the read-only
 * Stripe id / status fields refresh.
 *
 * Like the other admin components in this kit (LogoutButton, BrandIcon) it stays
 * dependency-free — no `@payloadcms/ui` import — and mirrors Payload's own button
 * classes so it looks native. The doc's collection + id are read from the admin
 * edit URL (`/admin/collections/<collection>/<id>`); `create` means unsaved.
 */
function parseDocPath(): { collection: string; id: string } | null {
  if (typeof window === "undefined") return null;
  const m = /\/admin\/collections\/([^/]+)\/([^/?#]+)/.exec(
    window.location.pathname,
  );
  if (!m) return null;
  const [, collection, id] = m;
  if (!collection || !id || id === "create") return null;
  return { collection, id };
}

export function SyncToStripeButton() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  async function sync() {
    const doc = parseDocPath();
    if (!doc) {
      setMessage({ ok: false, text: "Save the document first, then sync." });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/stripe/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(doc),
      });
      const data = (await res.json()) as {
        error?: string;
        results?: { ok: boolean; error?: string }[];
      };
      if (!res.ok) {
        setMessage({
          ok: false,
          text:
            data.error ??
            data.results?.find((r) => !r.ok)?.error ??
            "Sync failed.",
        });
      } else {
        setMessage({ ok: true, text: "Synced to Stripe." });
        setTimeout(() => window.location.reload(), 700);
      }
    } catch {
      setMessage({
        ok: false,
        text: "Sync failed — check your connection and Stripe key.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="field-type" style={{ marginBottom: "1rem" }}>
      <button
        type="button"
        className="btn btn--style-primary btn--size-small"
        disabled={busy}
        onClick={() => void sync()}
      >
        <span className="btn__content">
          <span className="btn__label">
            {busy ? "Syncing…" : "Sync to Stripe"}
          </span>
        </span>
      </button>
      {message ? (
        <p
          style={{
            fontSize: "0.8rem",
            marginTop: "0.5rem",
            color: message.ok
              ? "var(--theme-success-500)"
              : "var(--theme-error-500)",
          }}
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
