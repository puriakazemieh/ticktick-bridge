# Plan 002: Synchronize bound Markdown tasks safely in both directions

> **Executor instructions**: Run the drift check and Plan 001's verification first. Use the managed-storage service for every journal, report, and snapshot; do not create a second storage scheme.
>
> **Drift check (run first)**: `git diff --stat b86e322..HEAD -- src/core/markdown-task.js src/core/ticktick-client.js src/obsidian/main.ts test`

## Status

- **Status**: Complete on `main` (2026-10-24)
- **Priority**: P0
- **Effort**: L
- **Risk**: HIGH — may edit Markdown and remote tasks.
- **Depends on**: `plans/001-managed-storage-and-backups.md`
- **Category**: direction / data integrity
- **Planned at**: commit `b86e322`, 2026-10-14

## Why this matters

The Bridge imports `#ticktick` checkboxes by adding an opaque local UUID comment (`main.ts:139-163`), but it does not bind the returned TickTick task ID to that line. `src/core/markdown-task.js` already recognizes legacy `%%[ticktick_id:: …]%%` bindings, and `AUDIT.md` reports 362 such legacy tasks. A reliable feature must preserve user Markdown, detect field-level conflicts, survive offline work, and never create duplicates from a retry.

## Current state

- `src/core/markdown-task.js:1-18` parses a checkbox and legacy TickTick ID but yields only title/completed/raw state.
- `src/obsidian/main.ts:123-163` scans changed Markdown, creates remote tasks, then writes `<!-- ticktick-bridge:<random UUID> -->`; it discards the remote ID.
- `main.ts:336-405` offers optimistic cached mutations and an in-settings conflict count, but 4xx errors have no resolution UI.
- `src/core/ticktick-client.js:47-61` supports task CRUD and dedicated recurrence completion; it lacks a single-task read helper even though project data is available.
- Existing `test/client.test.js` and `test/date.test.js` use Node test/assert; match this style.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Tests | `npm test` | all pass |
| Typecheck | `npm run check` | exit 0 |
| Build | `npm run build` | exit 0 |

## Scope

**In scope**:

- `src/core/markdown-task.js`, `src/core/task-binding.js` (new), `src/core/task-diff.js` (new)
- `src/core/ticktick-client.js`
- `src/obsidian/main.ts`, `src/obsidian/markdown-sync.ts` (new), `src/obsidian/conflict-modal.ts` (new)
- `test/markdown-task.test.js` (new), `test/task-diff.test.js` (new), `test/client.test.js`
- `README.md`

**Out of scope**:

- Checklist item editing (Plan 005), generated per-task files, project-note migration, private TickTick endpoints, and automatic deletion of a remote task when a Markdown line disappears.

## Steps

### Step 1: Establish a precise, backward-compatible task binding format

Extend the parser to recognize both legacy `%%[ticktick_id:: ID]%%` and a new hidden HTML comment that stores only public identity: `<!-- ticktick-bridge:task id=… project=… v=1 -->`. Add pure serialize/replace functions that preserve indentation, checkbox marker, title text, every unknown emoji token, and line ending. The serializer must never write an access token or arbitrary task content into comments.

Create a binding model with source path, stable line locator (line + surrounding fingerprint), task ID, project ID, task kind, and last synchronized field baseline. Persist baselines/journals through Plan 001; do not put a large binding registry into settings.

**Verify**: add tests for legacy import, new serialize/parse roundtrip, Persian titles, duplicate title lines, CRLF, and marker preservation; `npm test` passes.

### Step 2: Build field-level reconciliation before UI wiring

Create `task-diff.js` that compares `base`, `local`, and `remote` for the supported v1 fields: title, completion, project ID, priority, tags, start date, due date, all-day flag, recurrence rule, and description. Its result must be an explicit list of local-only changes, remote-only changes, equal changes, and same-field conflicts. A remote completion of a recurring task is an occurrence event: preserve the remote-generated next occurrence; never calculate the next due date locally.

Rules: pull remote-only fields into the managed portion of the line; push local-only fields with a fresh remote read immediately before update; simultaneous changes to different fields merge; simultaneous changes to the same field require the conflict modal. Missing remote ID, duplicate binding, moved/deleted source file, and ambiguous create response become quarantine/report entries, never an automatic retry.

**Verify**: `test/task-diff.test.js` covers all four outcomes, recurring completion, removed remote task, and a same-field conflict.

### Step 3: Replace one-way checkbox import with an explicit sync engine

Create `markdown-sync.ts` to scan configured Markdown files on command and after debounced vault changes. A new tagged checkbox creates a durable `prepared` journal entry, calls TickTick once, records the returned ID, then writes the binding marker. If the process ends after send but before the marker write, the next run must show an ambiguous-operation report and require user adoption/search—not send a duplicate create.

For an existing binding, read the current remote record/project snapshot, reconcile, then make the smallest necessary remote write. Register provenance for plugin writes so `vault.modify` does not loop back. Do a preview-only first run: list create/update/pull/conflict/quarantine counts and affected paths. "Apply" must be a second, explicit action. Before an apply batch, use Plan 001 to snapshot both proposed Markdown changes and remote pre-write task documents.

**Verify**: use a fake client/adapter integration test to show preview makes zero writes; one confirmed create makes exactly one remote call and one bound local line; a replay performs zero creates.

### Step 4: Add conflict and recovery UX

Implement a modal/report view with side-by-side field values and actions: Keep Obsidian, Keep TickTick, Merge non-conflicting fields, Unbind, and Skip. Each choice must write an immutable report under `.ticktick/reports/`, refresh the baseline, and leave unrelated Markdown untouched. Surface a badge in Settings and commands for Preview Markdown sync, Apply preview, Open conflicts, and Repair bindings.

Migrate existing legacy bindings only after scan: match by existing ID plus project lookup, populate a baseline, and report dangling or duplicate IDs. Do not alter old marker syntax until the corresponding task is verified.

**Verify**: `npm test && npm run check && npm run build` passes; manually verify with a disposable TickTick project and two identically titled lines.

## Test plan

- Characterize Markdown parser/serializer against line endings, RTL content, legacy markers, repeated titles, and user tokens.
- Create/update/complete/reopen flows, including an offline queue and restart between remote response and local bind write.
- Field-level merge and every modal choice.
- Remote deletion, local file rename, duplicate identity, invalid/missing marker, and a change made by the plugin itself.

## Done criteria

- [x] A synced Markdown checkbox contains a verified TickTick task ID and project ID.
- [x] Preview mode produces no Vault or TickTick mutations.
- [x] A rerun after any ambiguous create does not automatically duplicate a task.
- [x] Same-field changes require a visible user choice; reports/snapshots live only under `.ticktick/`.
- [x] `npm test`, `npm run check`, and `npm run build` pass.

## STOP conditions

- STOP if a remote create response cannot supply an identity or cannot be safely read back.
- STOP if changing a task requires a private web endpoint rather than the official client surface.
- STOP if a Markdown syntax decision would alter content outside the managed marker/recognized task tokens.

## Maintenance notes

Calendar, Kanban, and checklist code must call this engine for task writes. Keep v1 fields narrow; adding attachments, arbitrary rich text transforms, or automatic remote deletion requires a separate threat-modelled plan.
