"use client";

import { useEffect, useState } from "react";

interface Tag {
  id: string;
  name: string;
  color: string | null;
}

/** The cms.users doc id from the admin edit URL (/admin/collections/users/<id>). */
function docIdFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const m = /\/admin\/collections\/users\/([^/?#]+)/.exec(
    window.location.pathname,
  );
  const id = m?.[1];
  return id && id !== "create" ? id : null;
}

/**
 * Read/manage a user's tags on the Payload Users page (a `ui` field). Tags live
 * in Supabase (RLS-governed `public` schema); this talks to the staff-only
 * /api/cms/user-tags endpoint which uses the service-role client. Auto plan-name
 * tags (from the Stripe webhook) show here alongside any staff-added tags.
 */
export function UserTagsManager() {
  const [docId, setDocId] = useState<string | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const id = docIdFromUrl();
    setDocId(id);
    if (!id) return;
    void fetch(`/api/cms/user-tags?docId=${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : { tags: [] }))
      .then((d: { tags?: Tag[] }) => setTags(d.tags ?? []))
      .catch(() => undefined);
  }, []);

  async function mutate(method: "POST" | "DELETE", body: Record<string, unknown>) {
    if (!docId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/cms/user-tags", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId, ...body }),
      });
      if (res.ok) {
        const d = (await res.json()) as { tags?: Tag[] };
        setTags(d.tags ?? []);
        setName("");
      }
    } finally {
      setLoading(false);
    }
  }

  if (!docId) {
    return (
      <div className="field-type">
        <label className="field-label">Tags</label>
        <p style={{ fontSize: "0.8rem", opacity: 0.7 }}>
          Save the user first to manage tags.
        </p>
      </div>
    );
  }

  return (
    <div className="field-type" style={{ marginBottom: "1rem" }}>
      <label className="field-label">Tags</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.5rem" }}>
        {tags.length === 0 ? (
          <span style={{ fontSize: "0.8rem", opacity: 0.7 }}>No tags yet.</span>
        ) : (
          tags.map((tag) => (
            <span
              key={tag.id}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
                padding: "0.15rem 0.5rem",
                borderRadius: "999px",
                fontSize: "0.75rem",
                background: tag.color ?? "var(--theme-elevation-100)",
                color: tag.color ? "#fff" : "inherit",
              }}
            >
              {tag.name}
              <button
                type="button"
                aria-label={`Remove ${tag.name}`}
                disabled={loading}
                onClick={() => void mutate("DELETE", { tagId: tag.id })}
                style={{ cursor: "pointer", background: "none", border: 0, color: "inherit" }}
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <input
          type="text"
          value={name}
          placeholder="Add a tag"
          onChange={(e) => setName(e.target.value)}
          style={{ flex: 1, padding: "0.35rem 0.5rem" }}
        />
        <button
          type="button"
          className="btn btn--style-secondary btn--size-small"
          disabled={loading || !name.trim()}
          onClick={() => void mutate("POST", { name: name.trim() })}
        >
          <span className="btn__content">
            <span className="btn__label">Add</span>
          </span>
        </button>
      </div>
    </div>
  );
}
