import { defineConfig } from "eslint/config";

import { baseConfig } from "@acme/eslint-config/base";

export default defineConfig(
  {
    ignores: ["dist/**"],
  },
  baseConfig,
  {
    // `src/types.ts` is generated verbatim by `pnpm db:gen-types` (supabase
    // gen types) — exempt it from stylistic rules so a regen never needs
    // hand-fixing. Prettier still formats it.
    files: ["src/types.ts"],
    rules: {
      "@typescript-eslint/consistent-type-definitions": "off",
      "@typescript-eslint/consistent-indexed-object-style": "off",
      "@typescript-eslint/no-redundant-type-constituents": "off",
    },
  },
);
