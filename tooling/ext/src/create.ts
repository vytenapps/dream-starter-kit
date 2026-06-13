import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { slugToSnake } from "@acme/ext-kit";

import { toAbs } from "./paths";
import { sync } from "./sync";

/**
 * `pnpm ext create <slug>` — scaffold a working extension following the
 * canonical kit patterns (manifest, RLS table + drop.sql, validator + hook,
 * web page + widget, native screen, authed ping route, settings screen, unit
 * test). Lock entry stays `source: "local"` (excluded from update checks).
 */
export async function create(repoRoot: string, slug: string): Promise<void> {
  const dir = toAbs(repoRoot, `extensions/${slug}`);
  const snake = slugToSnake(slug);
  const table = `ext_${snake}_items`;
  const title = slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  const pascal = title.replace(/ /g, "");

  const files: Record<string, string> = {
    "extension.config.ts": `import { defineExtension } from "@acme/ext-kit";

export default defineExtension({
  slug: "${slug}",
  name: "${title}",
  version: "1.0.0",
  kitCompat: ">=1.0.0 <2",
  description: "TODO: describe ${title}.",
  nav: {
    web: [{ title: "${title}", href: "/a/${slug}", order: 100 }],
    native: [{ title: "${title}", href: "/a/${slug}", order: 100 }],
  },
  routes: {
    web: [{ path: "", component: "${pascal}Page" }],
    native: [{ path: "", component: "${pascal}Screen" }],
  },
  widgets: { web: "${pascal}Widget", native: "${pascal}Widget" },
  server: { routes: true },
  database: { tables: ["${table}"] },
  cms: { hasSettings: true },
});
`,
    "package.json": `{
  "name": "@acme/ext-${slug}",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./native": "./src/native/index.ts",
    "./payload": "./src/payload/index.ts",
    "./server": "./src/server/index.ts",
    "./web": "./src/web/index.ts"
  },
  "license": "Apache-2.0",
  "scripts": {
    "clean": "git clean -xdf .cache .turbo node_modules",
    "format": "prettier --check . --ignore-path ../../.gitignore",
    "lint": "eslint --flag unstable_native_nodejs_ts_config",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@acme/api": "workspace:*",
    "@acme/ext-kit": "workspace:*",
    "@acme/ui": "workspace:*",
    "@acme/ui-native": "workspace:*",
    "@tanstack/react-query": "catalog:",
    "expo-router": "~6.0.13",
    "server-only": "^0.0.1",
    "zod": "catalog:"
  },
  "peerDependencies": {
    "react": "*",
    "react-native": "*"
  },
  "devDependencies": {
    "@acme/eslint-config": "workspace:*",
    "@acme/prettier-config": "workspace:*",
    "@acme/tsconfig": "workspace:*",
    "@types/react": "catalog:react19",
    "eslint": "catalog:",
    "payload": "catalog:",
    "prettier": "catalog:",
    "react": "catalog:react19",
    "react-native": "~0.81.5",
    "react-native-css": "3.0.1",
    "typescript": "catalog:",
    "vitest": "catalog:"
  },
  "prettier": "@acme/prettier-config"
}
`,
    "tsconfig.json": `{
  "extends": "@acme/tsconfig/base.json",
  "compilerOptions": {
    "lib": ["ES2022", "dom", "dom.iterable"],
    "jsx": "preserve",
    "moduleSuffixes": [".ios", ".android", ".native", ""]
  },
  "include": ["src", "tests", "extension.config.ts", "nativewind-env.d.ts"],
  "exclude": ["node_modules", "supabase"]
}
`,
    "eslint.config.ts": `import { defineConfig } from "eslint/config";

import { baseConfig } from "@acme/eslint-config/base";
import { reactConfig } from "@acme/eslint-config/react";

export default defineConfig(
  {
    ignores: ["supabase/**", "src/payload/migrations/2*"],
  },
  baseConfig,
  reactConfig,
);
`,
    "vitest.config.ts": `import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
`,
    "nativewind-env.d.ts": `/// <reference types="react-native-css/types" />
`,
    "README.md": `# ${title}

A Dream Starter Kit extension. Develop it inside a kit clone; \`pnpm ext sync\`
regenerates the host registries/stubs after any manifest change.
`,
    [`supabase/migrations/001_initial.sql`]: `-- ${title} extension · initial schema (owner-scoped, canonical RLS pattern).
create table if not exists public.${table} (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now()
);
create index if not exists ${table}_user_id_idx on public.${table} (user_id);

alter table public.${table} enable row level security;

drop policy if exists "${table}: own" on public.${table};
create policy "${table}: own"
  on public.${table} for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
`,
    "supabase/drop.sql": `-- Teardown for \`pnpm ext remove ${slug}\` (skipped with --keep-data).
drop table if exists public.${table} cascade;
`,
    "src/index.ts": `export * from "./validators/item";
export { useCreateItem, useItems } from "./hooks/use-items";
`,
    "src/validators/item.ts": `import { z } from "zod/v4";

export const createItemSchema = z.object({
  title: z.string().min(1).max(200),
});
export type CreateItemInput = z.infer<typeof createItemSchema>;
`,
    "src/hooks/use-items.ts": `"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useSession, useSupabase } from "@acme/api";

const itemsKey = ["${slug}-items"] as const;

export function useItems() {
  const supabase = useSupabase();
  const { user } = useSession();
  return useQuery({
    queryKey: itemsKey,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("${table}")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateItem() {
  const supabase = useSupabase();
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (title: string) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("${table}")
        .insert({ user_id: user.id, title });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: itemsKey }),
  });
}
`,
    "src/web/index.ts": `export { ${pascal}Page } from "./page";
export { ${pascal}Widget } from "./widget";
`,
    "src/web/page.tsx": `"use client";

import { useState } from "react";

import { Button } from "@acme/ui/button";
import { Card, CardHeader, CardTitle } from "@acme/ui/card";
import { Input } from "@acme/ui/input";

import { useCreateItem, useItems } from "../index";

export function ${pascal}Page() {
  const items = useItems();
  const createItem = useCreateItem();
  const [title, setTitle] = useState("");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          void createItem.mutateAsync(title.trim()).then(() => setTitle(""));
        }}
      >
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New item…"
        />
        <Button type="submit" disabled={createItem.isPending}>
          Add
        </Button>
      </form>
      <ul className="grid gap-2">
        {items.data?.map((item) => (
          <li key={item.id}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{item.title}</CardTitle>
              </CardHeader>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
`,
    "src/web/widget.tsx": `"use client";

import { Card, CardDescription, CardHeader, CardTitle } from "@acme/ui/card";

import { useItems } from "../index";

export function ${pascal}Widget() {
  const items = useItems();
  return (
    <Card>
      <CardHeader>
        <CardDescription>${title}</CardDescription>
        <CardTitle className="text-xl">
          {items.data?.length ?? 0} item(s)
        </CardTitle>
      </CardHeader>
    </Card>
  );
}
`,
    "src/native/index.ts": `export { ${pascal}Screen } from "./screen";
export { ${pascal}Widget } from "./widget";
`,
    "src/native/screen.tsx": `import { FlatList, View } from "react-native";
import { Stack } from "expo-router";

import { Text } from "@acme/ui-native/text";

import { useItems } from "../index";

export function ${pascal}Screen() {
  const items = useItems();
  return (
    <View className="bg-background flex-1 gap-3 p-4">
      <Stack.Screen options={{ title: "${title}" }} />
      <FlatList
        data={items.data ?? []}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <Text className="text-muted-foreground">No items yet.</Text>
        }
        renderItem={({ item }) => (
          <Text className="border-border border-b py-3">{item.title}</Text>
        )}
      />
    </View>
  );
}
`,
    "src/native/widget.tsx": `import { View } from "react-native";

import { Text } from "@acme/ui-native/text";

import { useItems } from "../index";

export function ${pascal}Widget() {
  const items = useItems();
  return (
    <View className="border-border w-full rounded-md border p-3">
      <Text className="text-muted-foreground text-xs">${title}</Text>
      <Text className="text-base font-medium">
        {items.data?.length ?? 0} item(s)
      </Text>
    </View>
  );
}
`,
    "src/payload/index.ts": `export { settings } from "./settings";
`,
    "src/payload/settings.ts": `import { defineExtensionSettings } from "@acme/ext-kit/payload";

export const settings = defineExtensionSettings({
  slug: "${slug}",
  name: "${title}",
  fields: [
    {
      name: "greeting",
      type: "text",
      defaultValue: "Hello from ${title}!",
      admin: { description: "Returned by GET /api/ext/${slug}/ping." },
    },
  ],
});

export interface ${pascal}Settings extends Record<string, unknown> {
  greeting: string;
}
`,
    "src/server/index.ts": `import "server-only";

import type { ExtRouteTable } from "@acme/ext-kit/server";
import { getExtensionSettings } from "@acme/ext-kit/payload";

import type { ${pascal}Settings } from "../payload/settings";
import { settings } from "../payload/settings";

/** Authed + rate-limited by the host dispatcher (golden rule #6). */
export const routes: ExtRouteTable = {
  "GET /ping": async (_req, ctx) => {
    const s = await getExtensionSettings<${pascal}Settings>(
      await ctx.getPayload(),
      settings,
    );
    return Response.json({ ok: true, user: ctx.user.id, greeting: s.greeting });
  },
};
`,
    "tests/item.test.ts": `import { describe, expect, it } from "vitest";

import { createItemSchema } from "../src/validators/item";

describe("createItemSchema", () => {
  it("accepts a title", () => {
    expect(createItemSchema.parse({ title: "hi" }).title).toBe("hi");
  });
  it("rejects an empty title", () => {
    expect(createItemSchema.safeParse({ title: "" }).success).toBe(false);
  });
});
`,
    ".prettierignore": `src/payload/migrations/2*
`,
  };

  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }

  // Link the new workspace package BEFORE sync — loading the manifest needs
  // @acme/ext-kit resolvable from the new package.
  execSync("pnpm install", { cwd: repoRoot, stdio: "inherit" });
  await sync(repoRoot);
  console.log(
    `\nScaffolded extensions/${slug}. Next: pnpm db:reset && ` +
      `pnpm db:gen-types && pnpm cms:gen-types, then pnpm typecheck.`,
  );
}
