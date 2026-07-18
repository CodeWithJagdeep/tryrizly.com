import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // The Next.js app root is web/, not the repo root — point next-plugin rules
  // (e.g. no-html-link-for-pages) at it so they stop looking in the repo root.
  { settings: { next: { rootDir: "web" } } },
  // Override default ignores of eslint-config-next.
  // web/ holds the Next.js app, so its build artifacts live there too.
  globalIgnores([
    // Default ignores of eslint-config-next:
    "**/.next/**",
    "**/out/**",
    "**/build/**",
    "**/dist/**",
    "**/node_modules/**",
    "**/coverage/**",
    "**/next-env.d.ts",
  ]),
  {
    rules: {
      "react/no-unescaped-entities": "off",
      "react-hooks/set-state-in-effect": "off",
      "@next/next/no-img-element": "off",
      "@next/next/no-html-link-for-pages": "off",
    },
  },
]);

export default eslintConfig;
