import { defineConfig } from "eslint/config";

import { baseConfig } from "@acme/eslint-config/base";
import { reactConfig } from "@acme/eslint-config/react";

export default defineConfig(
  {
    ignores: [".expo/**", "expo-plugins/**"],
  },
  baseConfig,
  reactConfig,
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
