import { defineConfig } from "eslint/config";

import { baseConfig } from "@acme/eslint-config/base";
import { reactConfig } from "@acme/eslint-config/react";

export default defineConfig(
  {
    // Generated ext registries + route stubs are machine-owned (`pnpm ext sync`).
    ignores: [
      ".expo/**",
      "expo-plugins/**",
      "src/ext/*.generated.ts",
      "src/app/(app)/x/**",
    ],
  },
  baseConfig,
  reactConfig,
  {
    // Bundle safety (EXTENSIONS-PLAN.md §1.3): server/Payload/web extension
    // entries must never enter the Metro graph — only the client barrel (`.`)
    // and `./native` are RN-safe. The `server-only` + payload poison pills
    // back this up at compile time; the `expo export` CI smoke check is the
    // final backstop.
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@acme/ext-*/server",
                "@acme/ext-*/payload",
                "@acme/ext-*/web",
              ],
              message:
                "Only an extension's client barrel and /native entry are allowed in the native app.",
            },
            {
              group: ["react-dom", "next", "next/*"],
              message: "Web-only modules can't be bundled by Metro.",
            },
          ],
        },
      ],
    },
  },
  {
    // Native SDK + env glue (expo-notifications, process.env, deep-link APIs)
    // is loosely typed upstream — relax unsafe-* here. Feature logic lives in
    // @acme/app and stays fully strict.
    files: ["src/lib/**"],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
    },
  },
);
