"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";

/**
 * /admin/extensions — manage installed extensions (docs/EXTENSIONS-PLAN.md
 * §6): installed list from the BUNDLED lock, a curated catalog
 * (EXT_CATALOG_URL), install-from-GitHub and zip-upload forms, and the live
 * operations panel. Every mutation dispatches extension-ops.yml and lands as
 * a PR; without GITHUB_OPS_TOKEN the page is read-only with CLI instructions.
 *
 * Uses Payload's admin chrome class names so it inherits the admin theme.
 */

interface RegistryResponse {
  installed: { slug: string; name: string; version: string; system: boolean }[];
  lock: {
    extensions: Record<
      string,
      { version: string; source: unknown; pinned?: boolean }
    >;
  };
  opsConfigured: boolean;
  catalogUrl: string | null;
}

interface CatalogEntry {
  slug: string;
  name: string;
  description?: string;
  repo: string;
  latest?: string;
  kitCompat?: string;
}

interface OpsResponse {
  runs: {
    id: number;
    status: string;
    conclusion: string | null;
    url: string;
    title: string;
  }[];
  prs: { number: number; title: string; url: string }[];
}

const sourceLabel = (source: unknown): string => {
  if (typeof source === "string") return source;
  if (source && typeof source === "object" && "type" in source) {
    return String((source as { type: string }).type);
  }
  return "unknown";
};

export function ExtensionsView() {
  const [registry, setRegistry] = useState<RegistryResponse | null>(null);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [ops, setOps] = useState<OpsResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [installUrl, setInstallUrl] = useState("");

  const refresh = useCallback(async () => {
    const reg = (await fetch("/api/extensions/registry").then((r) =>
      r.ok ? r.json() : null,
    )) as RegistryResponse | null;
    setRegistry(reg);
    if (reg?.catalogUrl) {
      try {
        const cat = (await fetch(reg.catalogUrl).then((r) => r.json())) as {
          extensions?: CatalogEntry[];
        };
        setCatalog(cat.extensions ?? []);
      } catch {
        setCatalog([]);
      }
    }
    if (reg?.opsConfigured) {
      const o = (await fetch("/api/extensions/ops").then((r) =>
        r.ok ? r.json() : null,
      )) as OpsResponse | null;
      setOps(o);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function dispatchOp(body: Record<string, unknown>) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/extensions/ops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { error?: string };
      setMessage(
        res.ok
          ? "Dispatched — a PR will open shortly (see Operations below). Merging it deploys; migrations apply automatically when the new version deploys."
          : (json.error ?? "Dispatch failed"),
      );
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onUploadZip(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = e.currentTarget.elements.namedItem(
      "zip",
    ) as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch("/api/extensions/upload", {
        method: "POST",
        body: form,
      });
      const json = (await res.json()) as {
        url?: string;
        sha256?: string;
        error?: string;
      };
      if (!res.ok || !json.url || !json.sha256) {
        setMessage(json.error ?? "Upload failed");
        return;
      }
      await dispatchOp({ op: "add", source: json.url, sha256: json.sha256 });
    } finally {
      setBusy(false);
    }
  }

  if (!registry) {
    return (
      <div className="gutter--left gutter--right" style={{ paddingTop: 40 }}>
        <h1>Extensions</h1>
        <p>Loading…</p>
      </div>
    );
  }

  const installedSlugs = new Set(registry.installed.map((i) => i.slug));

  return (
    <div
      className="gutter--left gutter--right"
      style={{ paddingTop: 40, paddingBottom: 80, maxWidth: 900 }}
    >
      <h1>Extensions</h1>
      {!registry.opsConfigured && (
        <p style={{ opacity: 0.8 }}>
          Read-only: set <code>GITHUB_OPS_TOKEN</code> (and{" "}
          <code>GITHUB_REPO</code> off-Vercel) to install/update/remove from
          here. Until then use the CLI: <code>pnpm ext add &lt;url&gt;</code>,{" "}
          <code>pnpm ext update &lt;slug&gt;</code>,{" "}
          <code>pnpm ext remove &lt;slug&gt;</code>.
        </p>
      )}
      {message && (
        <p
          style={{ padding: "8px 12px", border: "1px solid", borderRadius: 4 }}
        >
          {message}
        </p>
      )}

      <h2 style={{ marginTop: 32 }}>Installed</h2>
      <table cellPadding={6} style={{ width: "100%", textAlign: "left" }}>
        <thead>
          <tr>
            <th>Extension</th>
            <th>Version</th>
            <th>Origin</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {registry.installed.map((ext) => {
            const entry = registry.lock.extensions[ext.slug];
            return (
              <tr key={ext.slug}>
                <td>
                  {ext.name} {ext.system ? "· system" : ""}
                  {entry?.pinned ? " · pinned" : ""}
                </td>
                <td>{ext.version}</td>
                <td>{sourceLabel(entry?.source)}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <a href={`/admin/collections/kit-extensions`}>
                    enable/disable
                  </a>
                  {" · "}
                  <a href={`/admin/collections/nav-items`}>menu</a>
                  {registry.opsConfigured &&
                    sourceLabel(entry?.source) === "github" && (
                      <>
                        {" · "}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void dispatchOp({ op: "update", slug: ext.slug })
                          }
                        >
                          update
                        </button>
                      </>
                    )}
                  {registry.opsConfigured && !ext.system && (
                    <>
                      {" · "}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Remove ${ext.name}? Its tables are DROPPED by the generated migration unless the PR is edited (--keep-data). This PR never auto-merges.`,
                            )
                          ) {
                            void dispatchOp({ op: "remove", slug: ext.slug });
                          }
                        }}
                      >
                        remove
                      </button>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {catalog.length > 0 && (
        <>
          <h2 style={{ marginTop: 32 }}>Catalog</h2>
          <div style={{ display: "grid", gap: 12 }}>
            {catalog.map((entry) => (
              <div
                key={entry.slug}
                style={{ border: "1px solid", borderRadius: 6, padding: 12 }}
              >
                <strong>{entry.name}</strong> {entry.latest ?? ""}
                <p style={{ margin: "4px 0" }}>{entry.description}</p>
                {installedSlugs.has(entry.slug) ? (
                  <em>Installed</em>
                ) : registry.opsConfigured ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void dispatchOp({ op: "add", source: entry.repo })
                    }
                  >
                    Install
                  </button>
                ) : (
                  <code>pnpm ext add {entry.repo}</code>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <h2 style={{ marginTop: 32 }}>Install from GitHub</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (installUrl) void dispatchOp({ op: "add", source: installUrl });
        }}
        style={{ display: "flex", gap: 8 }}
      >
        <input
          style={{ flex: 1, padding: 6 }}
          placeholder="https://github.com/you/dream-ext-thing[#v1.2.3]"
          value={installUrl}
          onChange={(e) => setInstallUrl(e.target.value)}
        />
        <button type="submit" disabled={busy || !registry.opsConfigured}>
          Install
        </button>
      </form>

      <h2 style={{ marginTop: 32 }}>Upload ZIP</h2>
      <form
        onSubmit={(e) => void onUploadZip(e)}
        style={{ display: "flex", gap: 8 }}
      >
        <input type="file" name="zip" accept=".zip" />
        <button type="submit" disabled={busy || !registry.opsConfigured}>
          Upload &amp; install
        </button>
      </form>

      {ops && (
        <>
          <h2 style={{ marginTop: 32 }}>Operations</h2>
          <ul>
            {ops.prs.map((pr) => (
              <li key={pr.number}>
                <a href={pr.url} target="_blank" rel="noreferrer">
                  PR #{pr.number}: {pr.title}
                </a>
              </li>
            ))}
            {ops.runs.map((run) => (
              <li key={run.id}>
                <a href={run.url} target="_blank" rel="noreferrer">
                  {run.title}
                </a>{" "}
                — {run.conclusion ?? run.status}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
