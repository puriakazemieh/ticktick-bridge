# Plan 005: Ship experimental checklist and subtask editing behind a safety gate

> **Executor instructions**: Do not begin until Plans 001 and 002 are DONE. Treat every checklist mutation as a durable, potentially ambiguous remote operation. This plan is intentionally opt-in.
>
> **Drift check (run first)**: `git diff --stat b86e322..HEAD -- src/core/ticktick-client.js src/obsidian/main.ts test styles.css`

## Status

- **Status**: Read-only implementation on `main` (2026-10-24). Write operations remain blocked pending a disposable-project verification of the official child-item API.
- **Priority**: P2
- **Effort**: L
- **Risk**: HIGH — remote checklist APIs may replace child IDs during an update.
- **Depends on**: `plans/001-managed-storage-and-backups.md`, `plans/002-safe-bidirectional-markdown-sync.md`
- **Category**: direction / experimental API surface
- **Planned at**: commit `b86e322`, 2026-10-14

## Why this matters

Task documents expose `items`, and the requested UI needs subtasks/checklists inside the task card/editor. The current client and editor neither show nor preserve them: `toTaskPayload` spreads the draft and can unintentionally send a full task document. Community characterization has reported possible child-ID replacement on an update, so making checklist edits a default operation would risk duplicating or disconnecting user data. The correct first version is a separately enabled experiment with a preflight probe, snapshot, journal, and recovery UI.

## Current state

- `src/core/ticktick-client.js:50-61` supports create/update/complete/delete at task level only.
- `main.ts:1292-1410` is the task editor; it edits title, project, due date, reminder, and Markdown description.
- Today and recurring renderers call `updateTask(toTaskPayload(...))` with no checklist-specific diffing.
- `scripts/sync-project-tasks.mjs` carries `columnId` but does not deal with child items.
- Plan 002 provides the required journal, baseline, snapshot, and conflict facilities.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Tests | `npm test` | all pass |
| Typecheck | `npm run check` | exit 0 |
| Build | `npm run build` | exit 0 |

## Scope

**In scope**:

- `src/core/checklist.js` (new), `src/core/ticktick-client.js`
- `src/obsidian/main.ts`, `src/obsidian/checklist-editor.ts` (new)
- `test/checklist.test.js` (new), `test/client.test.js`
- `styles.css`, `README.md`

**Out of scope**:

- Nested checklist trees if TickTick only models a flat item array.
- Automatic Markdown checklist sync; expose it only inside the task editor/card.
- Making checklist editing default-on, batch edits, or private API calls.

## Steps

### Step 1: Characterize the official API on a disposable corpus

Add an ignored developer-only probe (documented command, no token values) that creates a uniquely prefixed temporary task in a dedicated disposable project, reads it, then performs isolated add, title-edit, completion, reorder, removal, and final-item-removal experiments. It must record sanitized shapes/identity relationships under `.ticktick/reports/` or ignored developer output, clean up only IDs it created, and never touch a non-prefixed task. Require explicit environment confirmation for writes.

Do not implement write UI until the probe confirms which operations preserve child IDs and task metadata. Add a capability result (`unavailable`, `read-only`, `enabled-unverified`, `verified`) that is false by default.

**Verify**: all no-token unit tests pass; the probe refuses to run without the explicit disposable-project and write-confirmation guards.

### Step 2: Add read-only checklist rendering first

Create pure normalization/diff functions for flat TickTick `items`: preserve ID, title, status, sort order, dates, all-day/timezone, completed time, and unknown fields. Render a collapsed checklist section in cards/editor with a count and stable item labels. A checkbox in read-only mode shows the reason editing is disabled and opens Settings; it must not change the parent task completion.

**Verify**: fixture tests cover duplicate child titles, no IDs, completed children, empty arrays, unknown fields, and an item that looks like a Markdown checkbox in task content.

### Step 3: Implement guarded experimental changes

When the user enables the specific setting and the probe capability permits an operation, implement Add, rename, complete/reopen, remove, and reorder one at a time. Before each mutation: fresh-read parent task, calculate child-level diff, snapshot parent/items, write a `prepared` journal, send the narrowest confirmed payload, fresh-read result, reconcile returned IDs, then mark journal complete/report it. A timeout/bodyless response is ambiguous: do not retry; show recovery that asks the user to map candidates or abandon the operation.

If only some operations are verified, expose only those. If an update replaces every child ID, preserve an old-to-new mapping in the report and prohibit local Markdown binding to individual children.

**Verify**: fake-client tests prove each unverified operation performs zero network writes; verified operation receives exactly one journaled call and reconciliation result.

### Step 4: Integrate UX, reports, and documentation

Add an "Experimental checklist editing" setting with a clear warning, capability status, last probe date, and disable/reset control. Every task editor save must preserve existing items unless the user intentionally edited them in this component. Add an operation report link in the editor after an error. Document the exact supported operations and how to recover from ambiguous writes.

**Verify**: `npm test && npm run check && npm run build` → all succeed.

## Test plan

- Pure normalize/diff behavior including duplicate titles and ID replacement.
- Read-only UI makes zero calls.
- Prepared/sent/complete journal lifecycle, process restart, timeout, 4xx, and reconciliation.
- Parent fields remain unchanged when only checklist items are edited.

## Done criteria

- [x] Checklist display is safe and read-only by default.
- [x] No edit is visible until the user opts in and the capability says it is supported.
- [ ] Write operations are blocked pending API characterization.
- [x] `npm test`, `npm run check`, and `npm run build` pass.

## STOP conditions

- STOP if official API behavior cannot be characterized without touching a real user task.
- STOP if an operation cannot be represented without replacing unknown task/item fields.
- STOP if child IDs change in a way that makes the requested action ambiguous and no safe reconciliation is available.

## Maintenance notes

Do not widen the experimental toggle based on anecdotal success. Re-run the probe after a TickTick API/client change and retain sanitized reports so regressions are diagnosable.
