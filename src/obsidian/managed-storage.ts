import { backupPath, journalPath, managedRoot, publicManagedMetadata, reportPath, selectExpiredBackups } from "../core/managed-storage.js";

type VaultAdapter = { exists(path: string): Promise<boolean>; mkdir(path: string): Promise<void>; read(path: string): Promise<string>; write(path: string, data: string): Promise<void>; rename?(from: string, to: string): Promise<void>; remove(path: string): Promise<void>; list(path: string): Promise<{ files: string[]; folders: string[] }>; stat(path: string): Promise<{ size: number } | null> };
export class ManagedStorage {
  private adapter: VaultAdapter;
  constructor(adapter: VaultAdapter) { this.adapter = adapter; }
  private managedPath(path: string, area?: "backups" | "reports" | "journal") {
    const value = String(path);
    const prefix = `${managedRoot()}/`;
    const expected = area ? `${managedRoot()}/${area}/` : prefix;
    if (value.includes("\\") || !value.startsWith(expected) || value.split("/").some(part => !part || part === "." || part === "..")) throw new Error("Invalid managed storage path.");
    return value;
  }
  private async ensure(path: string) {
    const pieces = path.split("/");
    let current = "";
    for (const piece of pieces) { current = current ? `${current}/${piece}` : piece; if (!await this.adapter.exists(current)) await this.adapter.mkdir(current); }
  }
  private async writeJson(path: string, value: unknown) {
    path = this.managedPath(path);
    await this.ensure(path.split("/").slice(0, -1).join("/"));
    const serialized = JSON.stringify(publicManagedMetadata(value));
    const temporary = `${path}.tmp-${Date.now()}`;
    await this.adapter.write(temporary, serialized);
    try {
      if (this.adapter.rename) {
        try { await this.adapter.rename(temporary, path); }
        catch {
          // Some mobile adapters reject rename-overwrite. Keep a durable copy
          // of the old JSON until the replacement has safely landed.
          if (!await this.adapter.exists(path)) throw new Error("rename failed");
          const prior = await this.adapter.read(path);
          const preserved = `${path}.previous-${Date.now()}`;
          await this.adapter.write(preserved, prior);
          try {
            await this.adapter.remove(path);
            await this.adapter.rename(temporary, path);
            await this.adapter.remove(preserved);
          } catch {
            if (!await this.adapter.exists(path)) await this.adapter.write(path, prior);
            throw new Error("replacement failed");
          }
        }
      } else {
        await this.adapter.write(path, serialized);
        await this.adapter.remove(temporary);
      }
    } catch {
      try { if (await this.adapter.exists(temporary)) await this.adapter.remove(temporary); } catch { /* preserve the original error */ }
      throw new Error("Managed storage write failed.");
    }
  }
  async writeSnapshot(purpose: string, payload: unknown, capturedAt = new Date()) {
    const path = backupPath(capturedAt, purpose);
    await this.writeJson(path, { schemaVersion: 1, capturedAt: capturedAt.toISOString(), purpose, metadata: publicManagedMetadata(payload) });
    return path;
  }
  async readSnapshot(path: string) {
    path = this.managedPath(path, "backups");
    if (!/^\.ticktick\/backups\/\d{4}-\d{2}-\d{2}\/.+\.json$/.test(path)) throw new Error("Invalid managed snapshot path.");
    return JSON.parse(await this.adapter.read(path));
  }
  async writeReport(operation: string, report: unknown, capturedAt = new Date()) {
    const path = reportPath(capturedAt, operation);
    await this.writeJson(path, { schemaVersion: 1, capturedAt: capturedAt.toISOString(), operation, metadata: publicManagedMetadata(report) });
    return path;
  }
  async readReport(path: string) {
    path = this.managedPath(path, "reports");
    if (!/^\.ticktick\/reports\/.+\.json$/.test(path)) throw new Error("Invalid managed report path.");
    return JSON.parse(await this.adapter.read(path));
  }
  async latestReport() {
    const root = `${managedRoot()}/reports`;
    if (!await this.adapter.exists(root)) return null;
    const paths = (await this.adapter.list(root)).files.filter(path => /^\.ticktick\/reports\/.+\.json$/.test(path)).sort();
    return paths.length ? { path: paths.at(-1)!, report: await this.readReport(paths.at(-1)!) } : null;
  }
  async persistJournal(operationId: string, journal: unknown) { const path = journalPath(operationId); await this.writeJson(path, { schemaVersion: 1, operationId, metadata: publicManagedMetadata(journal) }); return path; }
  async readJournal(operationId: string) {
    const path = this.managedPath(journalPath(operationId), "journal");
    if (!await this.adapter.exists(path)) return null;
    return JSON.parse(await this.adapter.read(path));
  }
  async removeJournal(operationId: string) { const path = journalPath(operationId); if (await this.adapter.exists(path)) await this.adapter.remove(path); }
  async listManagedBackups() {
    const root = `${managedRoot()}/backups`;
    if (!await this.adapter.exists(root)) return [];
    const result: string[] = [];
    for (const folder of (await this.adapter.list(root)).folders) result.push(...(await this.adapter.list(folder)).files.filter(file => /^\.ticktick\/backups\/\d{4}-\d{2}-\d{2}\/.+\.json$/.test(file)));
    return result;
  }
  async pruneEligibleManagedBackups(now = new Date(), keepCalendarDays = 10) {
    const expired = selectExpiredBackups(await this.listManagedBackups(), now, keepCalendarDays);
    await Promise.all(expired.map((entry: string | { path: string }) => this.adapter.remove(typeof entry === "string" ? entry : entry.path)));
    return expired;
  }
  async legacyRootBackups() {
    const files = (await this.adapter.list("")).files.filter(path => /^ticktick-backup-[^/]+\.csv$/i.test(path));
    return Promise.all(files.map(async path => ({ path, size: (await this.adapter.stat(path))?.size ?? 0 })));
  }
  async migrateLegacyRootBackups() {
    const sources = await this.legacyRootBackups();
    const destinationFolder = `${managedRoot()}/backups/legacy-root`;
    await this.ensure(destinationFolder);
    const migrated: string[] = [];
    for (const source of sources) {
      const name = source.path.split("/").pop()!;
      const target = `${destinationFolder}/${name}`;
      try {
        await this.adapter.write(target, await this.adapter.read(source.path));
        if ((await this.adapter.stat(target))?.size !== source.size) throw new Error("byte length mismatch");
        await this.adapter.remove(source.path);
        migrated.push(source.path);
      } catch { try { if (await this.adapter.exists(target) && (await this.adapter.stat(target))?.size !== source.size) await this.adapter.remove(target); } catch { /* source remains recoverable */ } }
    }
    return { sources, migrated };
  }
}
