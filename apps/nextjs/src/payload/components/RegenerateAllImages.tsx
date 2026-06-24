"use client";

import { useState } from "react";

/**
 * "Regenerate all images" control on the Image Generation settings global (a
 * `ui` field). After editing the art-direction prompt (or model, or audit
 * settings), one click re-renders the images for every image-enabled doc that
 * has an image prompt against the CURRENT settings. Backed by the staff-only
 * /api/cms/regenerate-images route, which streams newline-delimited JSON
 * progress events ({ done, total, label }); this reads them and shows a live
 * "x of N" counter + progress bar.
 *
 * Save the global first so the new settings are persisted before regenerating.
 */
export function RegenerateAllImages() {
  const [busy, setBusy] = useState(false);
  const [percent, setPercent] = useState(0);
  const [label, setLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (
      !window.confirm(
        "Regenerate images for every doc that has an image prompt? This " +
          "re-renders their images using the current settings, and can take a " +
          "few minutes. Save the settings first.",
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setPercent(0);
    setLabel("Starting…");

    let res: Response;
    try {
      res = await fetch("/api/cms/regenerate-images", { method: "POST" });
    } catch {
      setError("Couldn't reach the server. Please retry.");
      setBusy(false);
      return;
    }

    const contentType = res.headers.get("Content-Type") ?? "";
    if (!contentType.includes("ndjson") || !res.body) {
      // JSON response: an error object (401/403/503) or unexpected status.
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(data?.error ?? `Regeneration failed (HTTP ${res.status}).`);
      setBusy(false);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const handleEvent = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      let event: {
        done?: number;
        total?: number;
        label?: string;
        complete?: boolean;
        processed?: number;
        failed?: number;
        error?: string;
      };
      try {
        event = JSON.parse(trimmed) as typeof event;
      } catch {
        return;
      }
      if (event.error) {
        setError(event.error);
        return;
      }
      if (typeof event.done === "number" && typeof event.total === "number") {
        setPercent(
          event.total > 0 ? Math.round((event.done / event.total) * 100) : 100,
        );
      }
      if (event.complete) {
        const failed = event.failed ?? 0;
        setLabel(
          `Regenerated images for ${event.processed ?? 0} item(s)` +
            (failed ? `, ${failed} failed (see server logs).` : "."),
        );
      } else if (event.label) {
        setLabel(event.label);
      }
    };

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) handleEvent(line);
      }
      if (buffer) handleEvent(buffer);
    } catch {
      setError("The connection dropped before regeneration finished.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="field-type" style={{ marginTop: "1rem" }}>
      <label className="field-label">Regenerate all images</label>
      <p style={{ fontSize: "0.8rem", opacity: 0.7, marginBottom: "0.4rem" }}>
        Re-render the images for every image-enabled doc from its image prompt
        using the settings above. Save your changes first — this replaces the
        existing images and can take a few minutes.
      </p>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <button
          type="button"
          className="btn btn--style-secondary btn--size-small"
          disabled={busy}
          onClick={() => void run()}
        >
          <span className="btn__content">
            <span className="btn__label">
              {busy ? "Regenerating…" : "Regenerate all images"}
            </span>
          </span>
        </button>
        {(busy || label) && !error && (
          <span style={{ fontSize: "0.8rem", opacity: 0.8 }}>
            {label}
            {busy ? ` (${percent}%)` : ""}
          </span>
        )}
        {error && (
          <span style={{ fontSize: "0.8rem", color: "var(--theme-error-500)" }}>
            {error}
          </span>
        )}
      </div>
      {busy && (
        <div
          aria-hidden
          style={{
            marginTop: "0.5rem",
            height: "4px",
            width: "100%",
            maxWidth: "320px",
            background: "var(--theme-elevation-150)",
            borderRadius: "2px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${percent}%`,
              background: "var(--theme-success-500, #2e8b57)",
              transition: "width 0.3s ease",
            }}
          />
        </div>
      )}
    </div>
  );
}
