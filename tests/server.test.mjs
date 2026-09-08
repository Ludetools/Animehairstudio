import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { createAppServer } from "../server.js";
import { writeProjectFile } from "../server/write-project.cjs";

async function temporaryDirectory(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "ahs-reliability-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
}

test("native save replaces a complete file and round-trips its contents", async (t) => {
  const directory = await temporaryDirectory(t);
  const destination = path.join(directory, "project.ahs");
  await writeProjectFile(destination, JSON.stringify({ name: "first" }));
  await writeProjectFile(destination, JSON.stringify({ name: "second", locks: [1, 2] }));
  assert.deepEqual(JSON.parse(await fs.readFile(destination, "utf8")), { name: "second", locks: [1, 2] });
  assert.deepEqual(await fs.readdir(directory), ["project.ahs"]);
});

test("failed replacement preserves the old project and a complete recovery copy", async (t) => {
  const directory = await temporaryDirectory(t);
  const destination = path.join(directory, "project.ahs");
  await fs.writeFile(destination, "original");
  const io = { ...fs, rename: async () => { throw Object.assign(new Error("locked"), { code: "EPERM" }); } };
  let failure;
  await assert.rejects(writeProjectFile(destination, "replacement", io), (error) => {
    failure = error;
    return error.code === "EPERM" && !!error.recoveryPath;
  });
  assert.equal(await fs.readFile(destination, "utf8"), "original");
  assert.equal(await fs.readFile(failure.recoveryPath, "utf8"), "replacement");
});

test("failed disk flush never changes the destination or leaves a partial recovery", async (t) => {
  const directory = await temporaryDirectory(t);
  const destination = path.join(directory, "project.ahs");
  await fs.writeFile(destination, "original");
  const io = { ...fs, open: async (...args) => {
    const handle = await fs.open(...args);
    return { writeFile: (...values) => handle.writeFile(...values), close: () => handle.close(),
      sync: async () => { throw new Error("disk full"); } };
  } };
  await assert.rejects(writeProjectFile(destination, "partial", io), /disk full/);
  assert.equal(await fs.readFile(destination, "utf8"), "original");
  assert.deepEqual(await fs.readdir(directory), ["project.ahs"]);
});

test("local HTTP service rejects foreign origins, malformed URLs and private paths", async (t) => {
  const directory = await temporaryDirectory(t);
  await fs.writeFile(path.join(directory, "index.html"), "fixture");
  await fs.writeFile(path.join(directory, "server.js"), "private");
  let saves = 0;
  const server = createAppServer({ rootDirectory: directory, saveHandler: (_request, response) => {
    saves += 1; response.end("saved");
  } });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const port = server.address().port;
  const origin = `http://127.0.0.1:${port}`;
  const request = (pathname, headers = {}, method = "GET") => new Promise((resolve, reject) => {
    const outgoing = http.request({ hostname: "127.0.0.1", port, path: pathname, method, headers }, (response) => {
      let body = "";
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => resolve({ status: response.statusCode, headers: response.headers, body }));
    });
    outgoing.on("error", reject); outgoing.end();
  });
  assert.equal((await request("/")).body, "fixture");
  assert.equal(JSON.parse((await request("/api/health")).body).app, "anime-hair-studio");
  for (const value of ["https://example.com", "null", "http://localhost:1"]) {
    assert.equal((await request("/api/save-project", { Origin: value }, "POST")).status, 403);
  }
  assert.equal(saves, 0);
  const saved = await request("/api/save-project", { Origin: origin }, "POST");
  assert.equal(saved.status, 200);
  assert.equal(saved.headers["access-control-allow-origin"], origin);
  assert.equal(saves, 1);
  assert.equal((await request("/api/health", { Host: `evil.example:${port}` })).status, 403);
  assert.equal((await request("/%ZZ")).status, 400);
  assert.equal((await request("/%00")).status, 400);
  for (const target of ["/server.js", "/.git/config", "/node_modules/package.json", "/..%5cother%5cindex.html"]) {
    assert.equal((await request(target)).status, 403);
  }
  assert.equal((await request("/")).status, 200, "Malformed requests must not crash the server");
});

test("invalid native-save payloads are rejected without opening a dialog or crashing", async (t) => {
  const server = createAppServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const port = server.address().port;
  for (const body of ["null", "[]", "{}", "not-json"]) {
    const status = await new Promise((resolve, reject) => {
      const request = http.request({ hostname: "127.0.0.1", port, method: "POST", path: "/api/save-project",
        headers: { "Content-Type": "application/json" } }, (response) => {
        response.resume(); response.on("end", () => resolve(response.statusCode));
      });
      request.on("error", reject); request.end(body);
    });
    assert.equal(status, 400);
  }
});
