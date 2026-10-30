import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// eslint-config-next 16 ships flat configs, so no FlatCompat layer is needed.
const reactHooks = nextVitals.find((c) => c.plugins?.["react-hooks"])?.plugins["react-hooks"];

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "public/mockServiceWorker.js",
      "next-env.d.ts",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  ...nextVitals,
  ...nextTs,
  {
    // New in eslint-config-next 16 (react-hooks v7, React Compiler checks). They flag existing,
    // working code (mostly the imperative chart engine reading refs), so they warn until that
    // code is reworked for the compiler instead of failing the build.
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/incompatible-library": "warn",
    },
  },
  {
    // Playwright fixtures call `use()`, which is not React's hook.
    files: ["e2e/**"],
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
];

export default eslintConfig;
