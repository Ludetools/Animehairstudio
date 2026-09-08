import globals from "globals";

export default [
  { ignores: ["archive/**", "experiments/**", "assets/**", "node_modules/**", ".pnpm-store/**", "promo/v1-release/tools/package/**"] },
  {
    files: ["app.js", "modules/**/*.js"],
    languageOptions: { sourceType: "module", globals: globals.browser },
    rules: { "no-undef": "error" }
  },
  {
    files: ["server.js", "server/**/*.cjs", "scripts/**/*.mjs", "tests/**/*.mjs", "eslint.config.mjs"],
    languageOptions: { globals: globals.node },
    rules: { "no-undef": "error" }
  },
  { files: ["server.js", "server/**/*.cjs"], languageOptions: { sourceType: "commonjs" } }
];
