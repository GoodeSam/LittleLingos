#!/usr/bin/env node
// Behavioral tests for sw.js. Zero-dependency: executes the worker script in
// a vm context with a stub Cache Storage, fetch, and event objects, then
// drives the install/activate/fetch listeners directly. Covers the audit
// findings that had no coverage: activate deletes only this app's ll-*
// caches, cache writes are event-extended and guarded (no 206, no Range, no
// query variants), and the offline navigation fallback serves the shell.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import assert from "node:assert/strict";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const swSrc = readFileSync(join(ROOT, "sw.js"), "utf8");
const CACHE = (swSrc.match(/const CACHE = '([^']+)';/) || [])[1];
assert.ok(CACHE, "sw.js must declare const CACHE = 'll-…'");

const ORIGIN = "https://littlelingos.test";

function makeSW({ fetchImpl } = {}) {
  const stores = new Map(); // cacheName -> Map(urlKey -> response)
  const keyOf = (req) => (typeof req === "string" ? req : req.url);
  const cacheFor = (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const s = stores.get(name);
    return {
      addAll: async (list) => list.forEach(u => s.set(u, { status: 200, __shell: u })),
      put: async (req, res) => { s.set(keyOf(req), res); },
      match: async (req) => s.get(keyOf(req)),
    };
  };
  const listeners = {};
  const ctx = {
    self: {
      addEventListener: (t, fn) => { listeners[t] = fn; },
      skipWaiting: () => {},
      clients: { claim: async () => {} },
    },
    caches: {
      open: async (name) => cacheFor(name),
      keys: async () => [...stores.keys()],
      delete: async (name) => stores.delete(name),
      match: async (req) => {
        for (const s of stores.values()) { const r = s.get(keyOf(req)); if (r) return r; }
        return undefined;
      },
    },
    location: { origin: ORIGIN },
    URL,
    Response: class { static error() { return { __networkError: true }; } },
    fetch: (req) => (fetchImpl ? fetchImpl(req) : Promise.reject(new Error("no fetch impl"))),
    console,
  };
  vm.createContext(ctx);
  vm.runInContext(swSrc, ctx);
  // self.addEventListener is aliased as bare addEventListener in workers; the
  // script uses self.addEventListener, so listeners are captured above.
  return { listeners, stores, ctx };
}

function makeRequest(path, { mode = "no-cors", method = "GET", range = false, origin = ORIGIN } = {}) {
  return {
    url: origin + path,
    method, mode,
    headers: { has: (h) => (h.toLowerCase() === "range" ? range : false) },
  };
}

async function dispatchFetch(listeners, request) {
  const waits = [];
  let responded = null;
  const e = {
    request,
    respondWith: (p) => { responded = Promise.resolve(p); },
    waitUntil: (p) => { waits.push(Promise.resolve(p).catch(() => {})); },
  };
  listeners.fetch(e);
  const response = responded ? await responded : null;
  await Promise.all(waits);
  return { response, responded: responded !== null };
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test("activate deletes this app's old ll-* caches but leaves other same-origin caches alone", async () => {
  const { listeners, stores } = makeSW();
  stores.set("ll-old1", new Map());
  stores.set("ll-old2", new Map());
  stores.set("other-app-cache", new Map());
  stores.set(CACHE, new Map());
  const waits = [];
  listeners.activate({ waitUntil: (p) => waits.push(p) });
  await Promise.all(waits);
  assert.equal(stores.has("ll-old1"), false);
  assert.equal(stores.has("ll-old2"), false);
  assert.equal(stores.has("other-app-cache"), true, "foreign caches are not ours to delete");
  assert.equal(stores.has(CACHE), true, "the current cache must survive activation");
});

test("install precaches the SHELL into the current cache", async () => {
  const { listeners, stores } = makeSW();
  const waits = [];
  listeners.install({ waitUntil: (p) => waits.push(p) });
  await Promise.all(waits);
  const shell = stores.get(CACHE);
  assert.ok(shell && shell.has("./index.html") && shell.has("./scenarios.js") && shell.has("./manifest.json"));
});

test("cache-first: a 200 response is written to the cache via waitUntil", async () => {
  const res = { status: 200, ok: true, clone: () => ({ status: 200, __clone: true }) };
  const { listeners, stores } = makeSW({ fetchImpl: async () => res });
  const { response } = await dispatchFetch(listeners, makeRequest("/audio/b01_normal.mp3"));
  assert.equal(response, res);
  assert.ok(stores.get(CACHE)?.get(ORIGIN + "/audio/b01_normal.mp3")?.__clone,
    "successful full response must be persisted");
});

test("cache-first: a 206 partial response is served but never cached", async () => {
  const res = { status: 206, ok: true, clone: () => ({ status: 206 }) };
  const { listeners, stores } = makeSW({ fetchImpl: async () => res });
  const { response } = await dispatchFetch(listeners, makeRequest("/audio/b01_normal.mp3"));
  assert.equal(response, res);
  assert.equal(stores.get(CACHE)?.get(ORIGIN + "/audio/b01_normal.mp3"), undefined);
});

test("cache-first: a Range request is never cached even when the response is 200", async () => {
  const res = { status: 200, ok: true, clone: () => ({ status: 200 }) };
  const { listeners, stores } = makeSW({ fetchImpl: async () => res });
  await dispatchFetch(listeners, makeRequest("/audio/b01_normal.mp3", { range: true }));
  assert.equal(stores.get(CACHE)?.get(ORIGIN + "/audio/b01_normal.mp3"), undefined);
});

test("query-string variants are served but not cached (no unbounded growth)", async () => {
  const res = { status: 200, ok: true, clone: () => ({ status: 200 }) };
  const { listeners, stores } = makeSW({ fetchImpl: async () => res });
  const { response } = await dispatchFetch(listeners, makeRequest("/icons/icon.svg?v=1"));
  assert.equal(response, res);
  assert.equal([...(stores.get(CACHE) || new Map()).keys()].length, 0);
});

test("network-first navigation falls back to the cached shell when offline", async () => {
  const { listeners, stores } = makeSW({ fetchImpl: async () => { throw new Error("offline"); } });
  const shellEntry = { status: 200, __shell: "./index.html" };
  stores.set(CACHE, new Map([["./index.html", shellEntry]]));
  const { response } = await dispatchFetch(listeners, makeRequest("/some/page", { mode: "navigate" }));
  assert.equal(response, shellEntry, "offline navigation must serve the cached app shell");
});

test("non-GET and cross-origin requests are not intercepted", async () => {
  const { listeners } = makeSW({ fetchImpl: async () => ({ status: 200, clone: () => ({}) }) });
  const post = await dispatchFetch(listeners, makeRequest("/api/translate", { method: "POST" }));
  assert.equal(post.responded, false, "POST must pass through untouched");
  const cross = await dispatchFetch(listeners, makeRequest("/x", { origin: "https://evil.example" }));
  assert.equal(cross.responded, false, "cross-origin must pass through untouched");
});

console.log("sw.js behavior tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
