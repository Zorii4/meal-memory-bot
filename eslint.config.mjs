// @ts-check
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  globalIgnores([".wrangler/**", "bootstrap-zori4/**", "test/**/*.d.ts", "worker-configuration.d.ts"]),
  {
    files: ["**/*.{js,mjs,ts,mts}"],
    extends: [js.configs.recommended, tseslint.configs.recommended]
  }
);
