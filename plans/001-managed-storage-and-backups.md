# Plan 001: Isolate managed TickTick data and retain ten days of backups

> **Executor instructions**: Follow this plan in order. Run every verification command. Update Plan 001 in `plans/README.md` only after all done criteria pass.
>
> **Drift check (run first)**: `git diff --stat b86e322..HEAD -- src package.json test scripts`
> If the current storage, settings, or sync code differs materially from the excerpts below, STOP and report the drift.

## Status

- **Priority**: P0
- **Effort**: M
- **Risk**: MED — this changes the location and retention of user backup artifacts.
- **Depends on**: none
- **Category**: migration / safety foundation
- **Planned at**: commit `b86e322`, 2026-10-14

## Why this matters

The vault root currently contains fourteen `ticktick-backup-*.csv` exports, each about 1.8 MB. The Bridge itself persists cache and pending operations through `Plugin.saveData`, but has no managed artifact directory, snapshot format, retention policy, or safe migration path. Before any two-way sync can edit Markdown or write TickTick, it needs recoverable, hidden, bounded storage that does not expose secrets.

## Current state

- `src/obsidian/main.ts:21-52` defines settings and keeps task/habit cache plus pending mutations in `data.json`.
- `src/obsidian/main.ts:121` persists with `saveData({ ...settings, cache })`; `refreshCacheFromTickTick` saves after a remote fetch at lines 308-334.
- `src/obsidian/main.ts:336-405` queues failed mutations but has no durable per-operation result journal or snapshot directory.
- `scripts/sync-project-tasks.mjs` reads token-bearing plugin data and can create remote tasks; it must not become the runtime storage mechanism.
- The vault root currently contains `ticktick-backup-*.csv`. The creator is not present in this repository, so treat their contents as opaque legacy exports.
- Tests use Node's built-in runner in `test/*.test.js`; small framework-free helpers are the established convention (`test/date.test.js`).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npm run check` | exit 0 |
| Tests | `npm test` | all tests pass |
| Build | `npm run build` | exit 0 and writes `main.js` only |

## Scope

**In scope**:

- `src/core/managed-storage.js` (new, pure path/name/retention helpers)
- `src/obsidian/managed-storage.ts` (new, Obsidian adapter wrapper)
- `src/obsidian/main.ts`
- `test/managed-storage.test.js` (new)
- `README.md`

**Out of scope**:

- Moving/deleting legacy root CSVs automatically at plugin load.
- Reading, copying, logging, or placing API tokens/web cookies in `.ticktick/`.
- Any task, habit, note, calendar, or Kanban behavior from later plans.

## Steps

### Step 1: Define a versioned managed-storage contract

Create pure helpers in `src/core/managed-storage.js` for the exact, POSIX-style vault-relative layout:

```text
.ticktick/
  backups/YYYY-MM-DD/<timestamp>-<purpose>.json
  reports/<timestamp>-<operation>.json
  journal/<operation-id>.json
  notes/                 # reserved for Plan 007
```

Use UTC ISO timestamps with characters safe for all supported filesystems. Expose `managedRoot()`, `backupPath(capturedAt, purpose)`, `reportPath(...)`, `journalPath(...)`, `parseManagedBackupPath(...)`, and `selectExpiredBackups(entries, now, keepCalendarDays = 10)`. Retention must compare the UTC date encoded in the managed path, preserve today plus the preceding nine dates, ignore malformed/unmanaged files, and be unit-testable without Obsidian.

**Verify**: `npm test -- --test-name-pattern="managed storage"` → new helper tests pass.

### Step 2: Add an Obsidian-only storage service

Create `src/obsidian/managed-storage.ts`, constructed from `App.vault.adapter`. It must lazily create parent folders; write JSON atomically using a temporary sibling then rename/replace where the adapter supports it; and return structured errors without including a token/cookie or task body in a Notice. Provide methods to write/read a snapshot, write a bounded report, persist/remove a journal record, list managed backups, and prune eligible managed backup files.

Use a small versioned envelope containing `schemaVersion`, `capturedAt`, `purpose`, and public task/habit metadata. Do not assume desktop-only Node `fs`: the manifest currently says `isDesktopOnly: false`.

**Verify**: extend `test/managed-storage.test.js` with fake-adapter tests for mkdir order, safe paths, malformed files, and a 10-day boundary; `npm test` passes.

### Step 3: Integrate safe snapshots and retention

In `main.ts`, instantiate the service once during `onload`. Before a future destructive/multi-record write, expose a reusable `createPrewriteSnapshot(purpose, payload)` method; use it immediately for any existing path that writes a batch or changes persistent queue/cache state only when the payload is non-secret. After a successful snapshot, run retention against **only** `.ticktick/backups/`. Failures to prune must be reported but must not cancel the already-completed user operation.

Add Settings entries showing `/.ticktick/` as the fixed managed data location, retention as 10 days, a button to open a human-readable last report, and a button labelled "Move legacy root backups". The migration command must first show number/total size of matching root CSVs; after explicit confirmation, copy each into `.ticktick/backups/legacy-root/`, verify copied byte length, then delete the source. A failed copy leaves the source untouched. It never matches files outside the exact `ticktick-backup-*.csv` pattern.

**Verify**: `npm run check` → exit 0; use a disposable vault to confirm the preview requires confirmation and no root file is removed without it.

### Step 4: Document and protect the contract

Document the folder structure, retention definition, manual recovery, and legacy migration in `README.md`. State that the folder is hidden from normal vault navigation but is user-owned recoverable data, and that it excludes credentials. Make later-plan code import the service rather than ad-hoc adapter writes.

**Verify**: `npm test && npm run check && npm run build` → all exit 0.

## Test plan

- Retain snapshots from today and exactly nine preceding UTC dates; select the tenth preceding date for deletion.
- Ignore malformed names, report files, journal files, and root-level CSVs during pruning.
- Verify a migration copies/validates one legacy CSV before deletion and leaves source on failure.
- Verify serialized snapshots never include fields named `apiToken`, `webSessionToken`, or `webSessionCookie`.

## Done criteria

- [ ] Every new managed artifact is under `/.ticktick/`; none is created at vault root.
- [ ] At most ten distinct UTC capture dates remain under `.ticktick/backups/` after pruning.
- [ ] Legacy backup move is previewed, confirmed, byte-verified, and reversible from the new location.
- [ ] `npm test`, `npm run check`, and `npm run build` pass.
- [ ] No source file outside Scope is modified.

## STOP conditions

- STOP if Obsidian's adapter cannot safely read/write a dot-prefixed vault path on a supported target; report platform behavior before selecting another location.
- STOP if the legacy CSVs are still being written by an unknown active automation; do not race it or delete its files.
- STOP if any proposed snapshot would include credentials, raw web headers, or a password.

## Maintenance notes

All future sync writers use this service. Reviewers should reject root writes and retention code that relies only on file modification time. A future setting may make retention configurable, but the first version must retain exactly ten calendar days as requested.
