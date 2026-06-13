import { describe, expect, it } from "vitest";

import { defineExtension } from "./manifest";
import {
  lintExtensionSql,
  slugToSnake,
  tablePrefix,
  validateManifest,
  validateManifestSet,
} from "./validate";

const base = {
  name: "Demo",
  version: "1.0.0",
  kitCompat: ">=1.0.0 <2",
};

describe("naming helpers", () => {
  it("converts slugs to table prefixes", () => {
    expect(slugToSnake("chat-plus")).toBe("chat_plus");
    expect(tablePrefix("chat-plus")).toBe("ext_chat_plus");
  });
});

describe("validateManifest", () => {
  it("accepts a well-formed manifest", () => {
    const m = defineExtension({
      ...base,
      slug: "chat",
      requires: ["notifications"],
      database: { tables: ["ext_chat_threads", "ext_chat_messages"] },
      server: { routes: true, edgeFunctions: ["chat-digest"] },
      cms: { hasSettings: true },
    });
    expect(validateManifest(m)).toEqual([]);
  });

  it("rejects tables outside the extension's prefix", () => {
    const m = defineExtension({
      ...base,
      slug: "chat",
      database: { tables: ["chat_threads", "ext_billing_x"] },
    });
    const errors = validateManifest(m);
    expect(errors).toHaveLength(2);
    expect(errors[0]).toContain('"chat_threads"');
  });

  it("rejects cms slugs outside the prefix and double-declared settings", () => {
    const m = defineExtension({
      ...base,
      slug: "billing",
      cms: {
        collections: ["plans"],
        globals: ["ext-billing-settings"],
        hasSettings: true,
      },
    });
    const errors = validateManifest(m);
    expect(errors.some((e) => e.includes('"plans"'))).toBe(true);
    expect(errors.some((e) => e.includes("implicit via cms.hasSettings"))).toBe(
      true,
    );
  });

  it("rejects unprefixed edge functions and self-requires", () => {
    const m = defineExtension({
      ...base,
      slug: "reminders",
      requires: ["reminders"],
      server: { edgeFunctions: ["process-reminders"] },
    });
    const errors = validateManifest(m);
    expect(errors.some((e) => e.includes('"process-reminders"'))).toBe(true);
    expect(errors.some((e) => e.includes("cannot require itself"))).toBe(true);
  });

  it("rejects reserved web mounts and unknown native mounts", () => {
    const m = defineExtension({
      ...base,
      slug: "demo",
      routes: {
        web: [{ path: "", component: "C", mount: "/admin/tools" }],
        native: [{ path: "", component: "C", mount: "settings" }],
      },
    });
    const errors = validateManifest(m);
    expect(errors.some((e) => e.includes("reserved core route"))).toBe(true);
    expect(errors.some((e) => e.includes('native mount "settings"'))).toBe(
      true,
    );
  });

  it("rejects mounts inside the /a default namespace but allows bare /a", () => {
    const inside = defineExtension({
      ...base,
      slug: "demo",
      routes: { web: [{ path: "", component: "C", mount: "/a/tools" }] },
    });
    expect(
      validateManifest(inside).some((e) =>
        e.includes("default-mount namespace"),
      ),
    ).toBe(true);

    const home = defineExtension({
      ...base,
      slug: "dashboard",
      routes: { web: [{ path: "", component: "C", mount: "/a" }] },
    });
    expect(validateManifest(home)).toEqual([]);
  });

  it("rejects native surface on a web-only extension", () => {
    const m = defineExtension({
      ...base,
      slug: "demo",
      platforms: { web: true, native: false },
      nav: { native: [{ title: "Demo", href: "/a/demo" }] },
    });
    expect(
      validateManifest(m).some((e) => e.includes("platforms.native is false")),
    ).toBe(true);
  });
});

describe("validateManifestSet", () => {
  it("detects cross-extension collisions", () => {
    const a = defineExtension({
      ...base,
      slug: "alpha",
      database: { tables: ["ext_alpha"] },
      routes: { web: [{ path: "", component: "A", mount: "/shared" }] },
    });
    const b = defineExtension({
      ...base,
      slug: "beta",
      database: { tables: ["ext_alpha"] },
      routes: { web: [{ path: "", component: "B", mount: "/shared" }] },
    });
    const errors = validateManifestSet([a, b]);
    expect(errors.some((e) => e.includes('table "ext_alpha"'))).toBe(true);
    expect(errors.some((e) => e.includes('web mount "/shared"'))).toBe(true);
  });

  it("requires dependencies to be installed", () => {
    const a = defineExtension({
      ...base,
      slug: "reminders",
      requires: ["notifications"],
    });
    const errors = validateManifestSet([a]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('requires "notifications"');
  });

  it("passes a valid set", () => {
    const notif = defineExtension({ ...base, slug: "notifications" });
    const rem = defineExtension({
      ...base,
      slug: "reminders",
      requires: ["notifications"],
    });
    expect(validateManifestSet([notif, rem])).toEqual([]);
  });
});

describe("lintExtensionSql", () => {
  const opts = {
    slug: "chat",
    file: "001_initial.sql",
    ownTables: ["ext_chat_threads", "ext_chat_messages"],
  };

  it("accepts SQL that only touches owned tables (auth.uid() allowed)", () => {
    const sql = `
      create table public.ext_chat_threads (
        id uuid primary key,
        user_id uuid not null
      );
      alter table public.ext_chat_threads enable row level security;
      create policy "own" on public.ext_chat_threads
        for all to authenticated using (user_id = (select auth.uid()));
      create index x on public.ext_chat_threads (user_id);
    `;
    expect(lintExtensionSql(sql, opts)).toEqual([]);
  });

  it("flags DDL on undeclared tables", () => {
    const sql = `alter table public.profiles add column hacked boolean;`;
    const errors = lintExtensionSql(sql, opts);
    expect(errors.some((e) => e.includes('"profiles"'))).toBe(true);
  });

  it("flags auth/storage references and role/grant DDL", () => {
    const errors = lintExtensionSql(
      `
      update auth.users set email = 'x';
      grant all on public.ext_chat_threads to anon;
      create role hacker;
      insert into storage.buckets (id) values ('x');
    `,
      opts,
    );
    expect(errors.some((e) => e.includes("auth schema"))).toBe(true);
    expect(errors.some((e) => e.includes("GRANT"))).toBe(true);
    expect(errors.some((e) => e.includes("role DDL"))).toBe(true);
    expect(errors.some((e) => e.includes("storage schema"))).toBe(true);
  });

  it("allows whitelisted DML from requires and rejects the rest", () => {
    const sql = `
      insert into public.ext_notifications (user_id) values ('x');
      insert into public.tags (name) values ('y');
    `;
    const errors = lintExtensionSql(sql, {
      ...opts,
      allowedDmlTables: ["ext_notifications"],
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('"tags"');
  });

  it("ignores commented-out SQL", () => {
    expect(lintExtensionSql(`-- drop table public.profiles;`, opts)).toEqual(
      [],
    );
  });
});
