import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_LANGUAGE,
  normalizeLanguage,
  SUPPORTED_LANGUAGES,
  translateUiString
} from "../modules/localization.js";

test("language support is limited to English and Japanese with an English fallback", () => {
  assert.deepEqual(SUPPORTED_LANGUAGES.map(({ id }) => id), ["en", "ja"]);
  assert.equal(DEFAULT_LANGUAGE, "en");
  assert.equal(normalizeLanguage("ja"), "ja");
  assert.equal(normalizeLanguage("fr"), "en");
  assert.equal(normalizeLanguage(null), "en");
});

test("Japanese translations preserve surrounding whitespace and dynamic counts", () => {
  assert.equal(translateUiString(" Settings ", "ja"), " 設定 ");
  assert.equal(translateUiString("12 strands", "ja"), "12 ストランド");
  assert.equal(translateUiString("24 verts / 12 tris", "ja"), "24 頂点 / 12 三角形");
  assert.equal(translateUiString("Settings", "en"), "Settings");
});

test("unknown product and authored names remain unchanged", () => {
  assert.equal(translateUiString("Anime Hair Studio", "ja"), "Anime Hair Studio");
  assert.equal(translateUiString("My Custom Hair", "ja"), "My Custom Hair");
});
