import assert from "node:assert/strict";
import test from "node:test";

import { contractPatternMatches } from "./helpers/contract-match.mjs";

test("contract matching scans broad ordered wildcards without changing ordering", () => {
  assert.equal(contractPatternMatches("alpha ... beta ... gamma", /alpha[\s\S]*beta[\s\S]*gamma/), true);
  assert.equal(contractPatternMatches("gamma ... beta ... alpha", /alpha[\s\S]*beta[\s\S]*gamma/), false);
});

test("contract matching preserves native alternation semantics", () => {
  const pattern = /canvas[\s\S]*encoded-plus|canvas[\s\S]*svg-plus/;
  assert.equal(contractPatternMatches("canvas ... svg-plus", pattern), true);
  assert.equal(contractPatternMatches("canvas ... missing", pattern), false);
});
