import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// IndexedDB boundary double: executes production storage control flow, not the
// browser's index-building implementation or its disk/structured-clone timings.
function fixture(initial = [], existing = true) {
  const records = new Map(initial.map(entry => [entry.id, entry]));
  const calls = [];
  let indexed = false;
  const database = {
    objectStoreNames: { contains: () => existing },
    close() {},
    createObjectStore() { existing = true; return schemaStore; },
    transaction() {
      const transaction = new EventTarget();
      let generation = 0;
      const request = operation => {
        const result = new EventTarget();
        const run = () => {
          const ticket = ++generation;
          setImmediate(() => {
            result.result = operation(run);
            result.dispatchEvent(new Event('success'));
            setImmediate(() => {
              if (ticket === generation) transaction.dispatchEvent(new Event('complete'));
            });
          });
        };
        run();
        return result;
      };
      transaction.objectStore = () => ({
        getAll() { throw new Error('Full snapshot scans must not be used'); },
        put(entry) { return request(() => { records.set(entry.id, entry); }); },
        delete(id) { return request(() => { records.delete(id); }); },
        get(id) { calls.push(['get', id]); return request(() => records.get(id)); },
        index(name) {
          assert.equal(name, 'menuMetadata');
          assert.ok(indexed);
          return { openKeyCursor(query, direction) {
            assert.equal(direction, 'prev');
            calls.push(['keys']);
            const entries = [...records.values()].sort((a, b) => b.updatedAt - a.updatedAt);
            let position = 0;
            return request(run => {
              const entry = entries[position++];
              return entry ? {
                key: [entry.updatedAt, entry.name, entry.id],
                get value() { throw new Error('Menu must never read cursor values'); },
                continue: run
              } : null;
            });
          } };
        }
      });
      return transaction;
    }
  };
  const schemaStore = {
    indexNames: { contains: () => indexed },
    createIndex(name, fields) {
      assert.equal(name, 'menuMetadata');
      assert.deepEqual([...fields], ['updatedAt', 'name', 'id']);
      indexed = true;
    }
  };
  const indexedDB = { open(name, version) {
    assert.equal(version, 2);
    const request = new EventTarget();
    request.result = database;
    request.transaction = { objectStore: () => schemaStore };
    queueMicrotask(() => {
      if (!indexed) request.dispatchEvent(new Event('upgradeneeded'));
      request.dispatchEvent(new Event('success'));
    });
    return request;
  } };
  const context = vm.createContext({ indexedDB });
  const source = readFileSync(new URL('../modules/recent-projects.js', import.meta.url), 'utf8');
  vm.runInContext(source.replaceAll('export ', ''), context);
  return { api: context, calls, records };
}

test('Recent-project upgrade preserves snapshots and lists metadata without reading contents', async () => {
  const content = 'large project snapshot';
  const { api, calls, records } = fixture([{ id: 'old.ahs', name: 'Old.ahs', updatedAt: 1, content }]);
  const entries = await api.listRecentProjects();
  assert.equal(entries[0].name, 'Old.ahs');
  assert.equal('content' in entries[0], false);
  assert.deepEqual(calls, [['keys']]);
  assert.equal(records.get('old.ahs').content, content);
  assert.equal((await api.readRecentProject('old.ahs')).content, content);
  assert.deepEqual(calls[1], ['get', 'old.ahs']);
  await assert.rejects(api.readRecentProject('missing'), /no longer available/);
});

test('Recent-project fresh storage saves, replaces and prunes using metadata only', async () => {
  const { api, records } = fixture([], false);
  for (let i = 0; i < 12; i++) {
    await api.rememberRecentProject({ name: `${i}.ahs`, content: `snapshot ${i}`, updatedAt: i });
  }
  assert.equal(records.size, 10);
  assert.ok(!records.has('0.ahs'));
  await api.rememberRecentProject({ name: '5.ahs', content: 'replacement', updatedAt: 20 });
  const entries = await api.listRecentProjects();
  assert.equal(entries[0].id, '5.ahs');
  assert.equal(entries.length, 10);
  assert.ok(entries.every(entry => !('content' in entry)));
  assert.equal((await api.readRecentProject('5.ahs')).content, 'replacement');
});

test('Recent menu retains rows while refreshing and defers snapshot retrieval to project open', async () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const source = app.slice(app.indexOf('async function renderRecentProjectsMenu()'),
    app.indexOf('function openDroppedApplicationFilePrompt(file)'));
  const rows = ['previous row'];
  let resolveList;
  let pendingFile;
  let reads = 0;
  const context = vm.createContext({
    console,
    recentProjectsSubmenu: {
      replaceChildren() { rows.length = 0; },
      append(row) { rows.push(row); }
    },
    document: { createElement: () => ({ addEventListener(name, handler) { this[name] = handler; } }) },
    listRecentProjects: () => new Promise(resolve => { resolveList = resolve; }),
    readRecentProject: async id => { reads++; assert.equal(id, 'test.ahs'); return { content: 'snapshot' }; },
    closeAppMenus() {},
    openDroppedApplicationFilePrompt(file) { pendingFile = file; }
  });
  vm.runInContext(source, context);
  const refresh = context.renderRecentProjectsMenu();
  assert.deepEqual(rows, ['previous row']);
  resolveList([{ id: 'test.ahs', name: 'Test.ahs', updatedAt: 1 }]);
  await refresh;
  assert.equal(rows[0].textContent, 'Test.ahs');
  assert.equal(reads, 0);
  rows[0].click();
  assert.equal(reads, 0, 'Opening the confirmation prompt must not retrieve the snapshot');
  assert.equal(await pendingFile.text(), 'snapshot');
  assert.equal(reads, 1);
  assert.ok(!app.includes('if (menu.id === "fileMenu") renderRecentProjectsMenu();'));
});
