import type { Validate } from "payload";

interface ProfileFieldDef {
  key: string;
  label?: string | null;
  type:
    | "text"
    | "textarea"
    | "number"
    | "select"
    | "multiselect"
    | "checkbox"
    | "date"
    | "url";
  options?: { value: string }[] | null;
  required?: boolean | null;
}

const typeOk = (def: ProfileFieldDef, value: unknown): boolean => {
  switch (def.type) {
    case "text":
    case "textarea":
      return typeof value === "string";
    case "url":
      return typeof value === "string" && /^https?:\/\//.test(value);
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "checkbox":
      return typeof value === "boolean";
    case "date":
      return typeof value === "string" && !Number.isNaN(Date.parse(value));
    case "select":
      return (
        typeof value === "string" &&
        (def.options ?? []).some((o) => o.value === value)
      );
    case "multiselect":
      return (
        Array.isArray(value) &&
        value.every(
          (v) =>
            typeof v === "string" &&
            (def.options ?? []).some((o) => o.value === v),
        )
      );
  }
};

/**
 * Validate `users.customFields` against the admin-defined `profile-fields`
 * global: unknown keys are rejected, required fields enforced, values checked
 * by declared type/options. The global read is gated on `event === 'submit'`
 * so it doesn't run on every admin-form keystroke.
 */
export const validateCustomFields: Validate = async (
  value: unknown,
  { event, req },
) => {
  if (value == null) return true;
  if (typeof value !== "object" || Array.isArray(value)) {
    return "Custom fields must be an object of key/value pairs.";
  }
  if (event === "onChange") return true;

  const global = (await req.payload
    .findGlobal({ slug: "profile-fields", depth: 0 })
    .catch(() => null)) as { fields?: ProfileFieldDef[] | null } | null;
  const defs = global?.fields ?? [];
  const byKey = new Map(defs.map((d) => [d.key, d]));
  const values = value as Record<string, unknown>;

  for (const key of Object.keys(values)) {
    if (!byKey.has(key)) return `Unknown custom field "${key}".`;
  }
  for (const def of defs) {
    const v = values[def.key];
    if (v == null || v === "") {
      if (def.required) return `"${def.label ?? def.key}" is required.`;
      continue;
    }
    if (!typeOk(def, v)) {
      return `"${def.label ?? def.key}" has an invalid value for type ${def.type}.`;
    }
  }
  return true;
};
