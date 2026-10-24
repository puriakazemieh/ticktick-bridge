import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";
import { backupPath, parseManagedBackupPath, publicManagedMetadata, selectExpiredBackups } from "../src/core/managed-storage.js";

test("retains today's UTC backup date and the nine preceding dates", () => {
  const now = new Date("2026-10-20T23:59:59.000Z");
  const paths = Array.from({ length: 11 }, (_, index) => backupPath(new Date(Date.UTC(2026, 9, 20 - index)), "cache"));
  const expired = selectExpiredBackups(paths, now);
  assert.deepEqual(expired, [paths[10]]);
});

test("ignores malformed, report, journal, and root CSV paths", () => {
  const safe = backupPath("2026-10-10T00:00:00.000Z", "cache");
  const ignored = [".ticktick/reports/report.json", ".ticktick/journal/id.json", "ticktick-backup-old.csv", ".ticktick/backups/no-date/file.json", ".ticktick/backups/2026-99-99/file.json"];
  assert.equal(parseManagedBackupPath(safe)?.date, "2026-10-10");
  assert.deepEqual(selectExpiredBackups([...ignored, safe], "2026-10-20T00:00:00.000Z"), [safe]);
});

test("managed filenames are Windows-safe UTC names", () => {
  assert.match(backupPath("2026-10-20T12:34:56.789Z", "cache snapshot"), /^\.ticktick\/backups\/2026-10-20\/2026-10-20T12-34-56-789Z-cache-snapshot\.json$/);
});

test("snapshot metadata excludes API and web credentials", () => {
  const metadata = publicManagedMetadata({ apiToken: "api", webSessionToken: "session", webSessionCookie: "cookie", headers: { Authorization: "Bearer secret" }, task: { id: "1", title: "public", content: "private task body", raw: "raw response" } });
  assert.deepEqual(metadata, { task: { id: "1", title: "public" } });
});

function loadManagedStorage(directory) {
  const output = join(directory, "managed-storage.cjs");
  buildSync({ entryPoints: [fileURLToPath(new URL("../src/obsidian/managed-storage.ts", import.meta.url))], bundle: true, platform: "node", format: "cjs", outfile: output });
  return createRequire(import.meta.url)(output).ManagedStorage;
}

function memoryAdapter(files = new Map()) {
  return {
    async exists(path) { return files.has(path) || [...files.keys()].some(key => key.startsWith(`${path}/`)); },
    async mkdir() {}, async read(path) { return files.get(path); }, async write(path, data) { files.set(path, data); },
    async rename(from, to) { if (files.has(to)) throw new Error("target exists"); files.set(to, files.get(from)); files.delete(from); }, async remove(path) { files.delete(path); },
    async list(path) { return { files: [...files.keys()].filter(key => key.startsWith(`${path}/`) && !key.slice(path.length + 1).includes("/")), folders: [] }; },
    async stat(path) { return files.has(path) ? { size: Buffer.byteLength(files.get(path)) } : null; },
  };
}

test("managed storage rejects root and traversal reads", async () => {
  const directory = mkdtempSync(join(tmpdir(), "ticktick-managed-storage-"));
  try {
    const storage = new (loadManagedStorage(directory))(memoryAdapter());
    await assert.rejects(() => storage.readSnapshot("../outside.json"), /Invalid managed/);
    await assert.rejects(() => storage.readSnapshot("ticktick-backup-root.csv"), /Invalid managed/);
    await assert.rejects(() => storage.readReport(".ticktick/reports/../journal/x.json"), /Invalid managed/);
    await assert.rejects(() => storage.readReport(".ticktick/reports\\..\\journal\\x.json"), /Invalid managed/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("report serialization redacts nested private task text", async () => {
  const directory = mkdtempSync(join(tmpdir(), "ticktick-managed-storage-"));
  try {
    const files = new Map(); const storage = new (loadManagedStorage(directory))(memoryAdapter(files));
    const path = await storage.writeReport("sync", { task: { id: "1", content: "private", desc: "private", body: "private", raw: "private", title: "visible" } }, new Date("2026-10-20T00:00:00Z"));
    assert.deepEqual(JSON.parse(files.get(path)).metadata, { task: { id: "1", title: "visible" } });
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("private runtime cache preserves task text outside reports and backups", async () => {
  const directory = mkdtempSync(join(tmpdir(), "ticktick-managed-storage-"));
  try {
    const files = new Map(); const storage = new (loadManagedStorage(directory))(memoryAdapter(files));
    await storage.writePrivateCache({ tasks: [{ id: "1", content: "private task text" }] });
    assert.deepEqual(await storage.readPrivateCache(), { tasks: [{ id: "1", content: "private task text" }] });
    assert.equal([...files.keys()].some(path => path.startsWith(".ticktick/backups/")), false);
    assert.equal([...files.keys()].some(path => path.startsWith(".ticktick/reports/")), false);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("latest report is selected and read from the managed reports folder", async () => {
  const directory = mkdtempSync(join(tmpdir(), "ticktick-managed-storage-"));
  try {
    const files = new Map(); const storage = new (loadManagedStorage(directory))(memoryAdapter(files));
    await storage.writeReport("first", { status: "old" }, new Date("2026-10-19T00:00:00Z"));
    await storage.writeReport("second", { status: "new" }, new Date("2026-10-20T00:00:00Z"));
    assert.deepEqual((await storage.latestReport()).report.metadata, { status: "new" });
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("rewrite survives adapters that reject rename-overwrite", async () => {
  const directory = mkdtempSync(join(tmpdir(), "ticktick-managed-storage-"));
  try {
    const files = new Map(); const storage = new (loadManagedStorage(directory))(memoryAdapter(files));
    const first = await storage.persistJournal("stable-id", { value: "old" });
    await storage.persistJournal("stable-id", { value: "new" });
    assert.equal(JSON.parse(files.get(first)).metadata.value, "new");
    assert.equal([...files.keys()].some(path => path.includes(".previous-")), false);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("legacy migration verifies byte length and keeps a failed source", async () => {
  const directory = mkdtempSync(join(tmpdir(), "ticktick-managed-storage-"));
  try {
    const ManagedStorage = loadManagedStorage(directory);
    const files = new Map([["ticktick-backup-good.csv", "okay"], ["ticktick-backup-bad.csv", "bad"]]);
    const adapter = {
      async exists(path) { return files.has(path) || [...files.keys()].some(key => key.startsWith(`${path}/`)); },
      async mkdir() {}, async read(path) { return files.get(path); }, async write(path, data) { files.set(path, path.endsWith("bad.csv") ? "x" : data); },
      async rename(from, to) { files.set(to, files.get(from)); files.delete(from); }, async remove(path) { files.delete(path); },
      async list(path) { if (path === "") return { files: [...files.keys()].filter(key => !key.includes("/")), folders: [] }; return { files: [], folders: [] }; },
      async stat(path) { return files.has(path) ? { size: Buffer.byteLength(files.get(path)) } : null; },
    };
    const result = await new ManagedStorage(adapter).migrateLegacyRootBackups();
    assert.deepEqual(result.migrated, ["ticktick-backup-good.csv"]);
    assert.equal(files.has("ticktick-backup-good.csv"), false);
    assert.equal(files.has(".ticktick/backups/legacy-root/ticktick-backup-good.csv"), true);
    assert.equal(files.has("ticktick-backup-bad.csv"), true);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
