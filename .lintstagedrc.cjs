// lint-staged runs from the repo root, but the frontend's ESLint flat config
// and tsconfig live inside frontend/. Rather than fight path-relativity
// across that boundary (fragile on Windows), any staged frontend TS/TSX
// file triggers a full `--prefix frontend` lint:fix + typecheck instead of
// a per-file command. Trade-off: lint-staged won't auto-re-stage files
// eslint --fix touches — if it changes anything, `git add` and commit again.
module.exports = {
  "frontend/**/*.{ts,tsx}": () => [
    "npm --prefix frontend run lint:fix",
    "npm --prefix frontend run typecheck",
  ],
};
