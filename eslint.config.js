// Lint rules: ESLint's recommended set, plus a few that catch real bugs.
// Run with `npm run lint`; CI fails on any error.

const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  { ignores: ["node_modules/", "engines/", "models/", "bin/", "dist/", "evals/.audio-cache/"] },

  js.configs.recommended,

  {
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrors: "none" }],
      eqeqeq: ["error", "always"],
      "prefer-const": "error",
      "no-var": "error",
      "no-console": ["error", { allow: ["warn", "error", "log"] }],
    },
  },

  // Main process, shared code, scripts, evals and tests run in Node.
  {
    files: ["src/main/**/*.js", "src/shared/**/*.js", "scripts/**/*.js", "evals/**/*.js", "test/**/*.js", "*.js"],
    languageOptions: { sourceType: "commonjs", globals: globals.node },
  },

  // The windows run in a sandboxed browser page (`window.flow` comes from preload.js).
  {
    files: ["src/renderer/**/*.js"],
    languageOptions: { sourceType: "script", globals: globals.browser },
  },

  // pill.js uses `recorder`, defined by recorder.js, which pill.html loads first.
  {
    files: ["src/renderer/pill.js"],
    languageOptions: { globals: { recorder: "readonly" } },
  },
];
