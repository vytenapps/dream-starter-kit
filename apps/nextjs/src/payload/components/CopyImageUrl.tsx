"use client";

import { CopyToClipboard, useFormFields } from "@payloadcms/ui";

/**
 * A `ui` field rendered beneath a generated-image upload: shows the cached
 * public URL of the attached media and a copy-to-clipboard button. Reads the
 * hidden `<field>Url` sibling (populated by the syncImageUrls hook) via
 * `clientProps.urlField`. Renders nothing until the URL exists.
 */
export function CopyImageUrl(props: { urlField?: string; label?: string }) {
  const urlField = props.urlField;
  const url = useFormFields(([fields]) => {
    if (!urlField) return undefined;
    const value = fields[urlField]?.value;
    return typeof value === "string" ? value : undefined;
  });

  if (!url) return null;

  return (
    <div style={{ marginBottom: "1rem", fontSize: "0.85rem" }}>
      <span style={{ opacity: 0.7, marginRight: "0.5rem" }}>
        {props.label ?? "Public URL"}:
      </span>
      <code style={{ wordBreak: "break-all" }}>{url}</code>{" "}
      <CopyToClipboard value={url} />
    </div>
  );
}
