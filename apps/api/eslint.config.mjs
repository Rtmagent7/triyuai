import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["src/generated/**", "coverage/**", "dist/**", ".pglite/**", "api/**"] },
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-namespace": "off",
    },
  },
);
