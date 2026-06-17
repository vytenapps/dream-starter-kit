/**
 * Write-verification for create_content / update_content.
 *
 * Payload's Local API does NOT error when it silently discards fields the
 * writer can't set — it saves the rest of the document, bumps `updatedAt`, and
 * returns the stored doc. Three things cause a silent discard:
 *
 *   1. Field-level access (`field.access.update` denies) — e.g. `ideas.planMd`.
 *   2. A `beforeChange` hook that strips the value — e.g. the derived,
 *      read-only `ideas.planMarkdown` (rebuilt from `planSections` on read).
 *   3. Invalid input that fails field validation and is dropped — e.g. a
 *      `blocks` array whose entries omit `blockType`, so every block is
 *      stripped and the field persists as `[]`.
 *
 * All three present identically to a naive caller: `{ updated: true }` plus an
 * advancing `updatedAt`, with the echoed doc showing the *stored* (unchanged)
 * state. To stop that false success, the tools re-read the document after the
 * write and run `detectDroppedFields` to confirm each supplied field actually
 * landed — never trusting the write's own echo.
 *
 * The detector is deliberately conservative to avoid *false* errors (as harmful
 * as false successes): it only flags a field when there is an unambiguous
 * signal it was not applied — a non-empty value sent but an empty value stored,
 * a read-only field whose stored value differs from what was sent, or a key
 * that is not a writable field in the collection schema. Rich content that
 * Payload normalizes on save (Lexical/blocks gain `id`, `blockName`, default
 * nodes) is never deep-compared unless the field is declared read-only, so a
 * genuinely-applied `planSections` write is never misreported.
 */

export interface FieldMeta {
  /** A real data field in the collection schema (false for `ui` fields). */
  known: boolean;
  /** Declared read-only (`admin.readOnly`) — derived/server-managed. */
  readOnly: boolean;
  /** Presentational `ui` field (no data) — not writable. */
  ui: boolean;
}

export type FieldMetaMap = Map<string, FieldMeta>;

export interface DroppedField {
  field: string;
  reason: string;
}

interface AnyField {
  name?: string;
  type?: string;
  fields?: AnyField[];
  tabs?: { name?: string; fields?: AnyField[] }[];
  admin?: { readOnly?: boolean };
}

/**
 * Flatten a (sanitized) collection's field list into a map of top-level data
 * key -> metadata. Descends through presentational containers (`row`,
 * `collapsible`, unnamed tabs) that don't introduce a data key, and records
 * named fields, named groups/tabs, and `ui` fields as their own top-level key.
 */
export function collectFieldMeta(fields: unknown): FieldMetaMap {
  const map: FieldMetaMap = new Map();
  const walk = (list: AnyField[]): void => {
    for (const f of list) {
      if (f.type === "tabs" && Array.isArray(f.tabs)) {
        for (const tab of f.tabs) {
          if (tab.name) {
            map.set(tab.name, { known: true, readOnly: false, ui: false });
          } else if (Array.isArray(tab.fields)) {
            walk(tab.fields);
          }
        }
        continue;
      }
      if (typeof f.name === "string" && f.name) {
        const ui = f.type === "ui";
        map.set(f.name, {
          known: !ui,
          readOnly: f.admin?.readOnly === true,
          ui,
        });
        continue;
      }
      // Presentational container (row / collapsible / unnamed) — descend.
      if (Array.isArray(f.fields)) walk(f.fields);
    }
  };
  walk(Array.isArray(fields) ? (fields as unknown as AnyField[]) : []);
  return map;
}

/** Empty = absent or carrying no information the caller meant to store. */
export function isEmptyValue(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.keys(v).length === 0;
  return false; // numbers (incl. 0) and booleans are meaningful values
}

/** Order-insensitive structural equality (JSON-shaped values only). */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined)
    return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length)
      return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (typeof a === "object" && typeof b === "object") {
    const ao = a as Record<string, unknown>;
    const bo = b as Record<string, unknown>;
    const ak = Object.keys(ao);
    const bk = Object.keys(bo);
    if (ak.length !== bk.length) return false;
    return ak.every(
      (k) =>
        Object.prototype.hasOwnProperty.call(bo, k) &&
        deepEqual(ao[k], bo[k]),
    );
  }
  return a === b;
}

/** Meta keys a caller may legitimately send that aren't schema fields. */
const META_KEYS = new Set(["id", "_status"]);

/**
 * Compare the fields the caller asked to write against the document Payload
 * actually stored (a fresh read, NOT the write echo). Returns the subset that
 * did not land, each with a human-readable reason.
 */
export function detectDroppedFields(args: {
  requested: Record<string, unknown>;
  persisted: Record<string, unknown>;
  fields: FieldMetaMap;
}): DroppedField[] {
  const { requested, persisted, fields } = args;
  const dropped: DroppedField[] = [];

  for (const [key, requestedValue] of Object.entries(requested)) {
    if (requestedValue === undefined) continue;
    if (META_KEYS.has(key) || key.startsWith("_")) continue;

    const meta = fields.get(key);

    // Not a writable data field (unknown key or a presentational `ui` field).
    if (!meta || meta.ui) {
      if (!isEmptyValue(requestedValue)) {
        dropped.push({
          field: key,
          reason: meta?.ui
            ? "not a data field (UI-only) — ignored by Payload"
            : "not a field in this collection's schema — ignored by Payload",
        });
      }
      continue;
    }

    // Caller is clearing the field — an empty request is honoured, not dropped.
    if (isEmptyValue(requestedValue)) continue;

    const persistedValue = persisted[key];

    // Sent a value, but nothing was stored: access-denied, hook-stripped, or
    // invalid input dropped by validation (e.g. blocks missing `blockType`).
    if (isEmptyValue(persistedValue)) {
      dropped.push({
        field: key,
        reason:
          "you sent a value but none was stored — the field is " +
          "access-restricted, or the value was invalid and stripped " +
          "(for `blocks` fields each entry must include its `blockType`)",
      });
      continue;
    }

    // Read-only / derived field whose stored value ignores your input.
    if (meta.readOnly && !deepEqual(requestedValue, persistedValue)) {
      dropped.push({
        field: key,
        reason:
          "read-only / derived field — the stored value is server-managed " +
          "and does not reflect your input",
      });
    }
  }

  return dropped;
}
