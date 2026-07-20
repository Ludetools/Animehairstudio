import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("static JavaScript control references exist in the HTML", async () => {
  const [html, source] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8")
  ]);
  const htmlIds = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]);
  const duplicates = htmlIds.filter((id, index) => htmlIds.indexOf(id) !== index);
  assert.deepEqual([...new Set(duplicates)], [], "HTML IDs must be unique");
  const idSet = new Set(htmlIds);
  const referencedIds = [...source.matchAll(/querySelector\(["']#([A-Za-z0-9_-]+)["']\)/g)].map((match) => match[1]);
  const optionalControls = new Set(["curveLatticeToggle"]);
  const missing = [...new Set(referencedIds.filter((id) => !idSet.has(id) && !optionalControls.has(id)))];
  assert.deepEqual(missing, [], `Missing controls: ${missing.join(", ")}`);
});

test("retired Place Strand tool has no visible or keyboard entry point", async () => {
  const [html, source] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8")
  ]);
  assert.doesNotMatch(html, /data-tool=["']place["']/);
  assert.doesNotMatch(source, /\ba\s*:\s*["']place["']/);
});
