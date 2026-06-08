"use client";

import * as React from "react";

import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";

interface MediaDoc {
  id: number;
  url?: string | null;
}

/**
 * Upload a branding image to the Payload Media collection via REST and report
 * the resulting media id + URL. Auth is the SSO cookie (credentials included);
 * `isAdmin` create access is enforced server-side.
 */
export function UploadTile({
  label,
  description,
  url,
  onChange,
  dark,
}: {
  label: string;
  description?: string;
  url: string | null;
  onChange: (value: { id: number; url: string | null } | null) => void;
  /** Render the preview on a dark backdrop (for dark-variant logos). */
  dark?: boolean;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("_payload", JSON.stringify({ alt: `${label} — ${file.name}` }));
      const res = await fetch("/cms-api/media", {
        method: "POST",
        body,
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      const json = (await res.json()) as { doc: MediaDoc };
      onChange({ id: json.doc.id, url: json.doc.url ?? null });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      <div className="flex items-center gap-3">
        <div
          className={`flex size-16 items-center justify-center overflow-hidden rounded-md border ${
            dark ? "bg-foreground" : "bg-muted"
          }`}
        >
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={label}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <span className="text-muted-foreground text-xs">None</span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {busy ? "Uploading…" : url ? "Change" : "Upload"}
            </Button>
            {url && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => onChange(null)}
              >
                Remove
              </Button>
            )}
          </div>
          {description && (
            <p className="text-muted-foreground text-xs">{description}</p>
          )}
          {error && <p className="text-destructive text-xs">{error}</p>}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
