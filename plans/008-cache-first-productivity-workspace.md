# Plan 008: Cache-first smart planning workspace

> Status: TODO  
> Priority: P1  
> Effort: Large  
> Risk: Medium  
> Planned: 2026-10-25  
> Depends on: Plans 001--007, the current local cache and mutation journal

## Goal

Turn TickTick Bridge into a cache-first planning workspace without making the
calendar or board wait for TickTick. Smart views, filtering, planning and
reviews must initially read the local `.ticktick` cache. A deliberate sync is
the only operation that refreshes remote data. Every mutation remains
optimistic locally, is journaled, and is reconciled with TickTick safely.

## Current integration points

- `src/obsidian/main.ts` owns `BridgeCache`, cache refresh, mutation execution,
  and the planner/board hosts. Extend this boundary instead of calling the API
  directly from views.
- `src/obsidian/project-board.ts` and `src/core/project-board.js` render the
  board and virtual views; recurring and tag virtual views already establish a
  useful pattern.
- `src/obsidian/planning-calendar.ts` and `src/core/calendar-range.js` own
  daily, weekly and monthly rendering, ranges, filters and calendar moves.
- `ManagedStorage` writes safe snapshots, operation reports and backups below
  `.ticktick/`.
- Regression coverage belongs with `test/project-board.test.js`,
  `test/calendar-range.test.js`, `test/managed-storage.test.js`, plus focused
  new tests for pure selectors and mutations.

## Guardrails

- Never fetch task details merely because the user opens a card. Show cached
  data immediately; expose a separate “refresh details” action when needed.
- Keep tokens, cookies and credentials out of cache, previews, reports and
  backups.
- Do not infer unsupported TickTick fields. Subtask/dependency writes are
  disabled until an isolated probe proves their contract.
- Preview destructive, multi-task and date-clearing operations. The preview
  states the exact affected count and sample titles; the final report is stored
  in `.ticktick/reports/`.
- Retain existing right-to-left, Jalali date, touch-scroll and accessible
  keyboard behavior in every new view.

## Delivery order

Implement sequentially: 1 → 2 → 3 → 4 → 5 → 6 → 7. Each phase ships with
tests, cache-only fallback, and a command/sidebar entry where it has a UI.

### 1. Smart views in the board sidebar

1. Add deterministic cache selectors for recurring, unscheduled, today,
   upcoming week, overdue, inbox, high priority and completed tasks. Define
   timezone and completion rules once in a pure core module.
2. Add a `Tags` sidebar group with count badges. Selecting a tag filters to
   that tag without a remote request; selecting a smart view is mutually clear
   with project/folder selection.
3. Give every smart view a grouping control: project, priority, due date or
   tag. Reuse board column rendering rather than maintaining separate cards.
4. Preserve list/folder ordering and make empty states explain the active
   selector.

Acceptance: opening a smart view is synchronous from cache, counts match the
visible tasks, and a manual sync is the only request that changes its data.

### 2. Shared filter bar, search and saved views

1. Extract one filter model for board, week and month: multiple projects,
   multiple tags, status, priority, date range and full-text search.
2. Define intersection/union semantics explicitly: project and tag groups are
   OR within a selected group, AND between filter groups; text is normalized
   for Persian/Arabic characters but displayed unchanged.
3. Add grouping and sort options to the same compact responsive control.
4. Persist named saved views in plugin settings, including scope, filter,
   grouping and sort; support rename, overwrite, duplicate and delete with
   confirmation. Saved views store IDs, not fragile display names.

Acceptance: applying the same saved view in board/week/month yields the same
task IDs and needs no server request.

### 3. Backlog and drag-to-plan

1. Add an “unscheduled” backlog column next to the week calendar, based on
   cache tasks with no effective date.
2. Dropping from backlog onto a day creates a local optimistic due date and
   queues the existing safe mutation. Dropping back clears the date only after
   a confirmation dialog.
3. For timed tasks, add an optional time grid; drag changes the local time
   while retaining timezone/Jalali display correctness.
4. On remote failure, restore the original cached task, mark the operation
   failed, and offer retry from the report rather than reloading the full view.

Acceptance: moves visibly complete without a page jump, survive refresh after
success, and rollback cleanly on simulated failure.

### 4. Project timeline / Gantt

1. Create a full-page timeline view for tasks with `startDate` and `dueDate`.
   It supports day/week/month zoom, project/tag filters and cache-only render.
2. Render range bars in a virtualized horizontal grid with clear RTL labels;
   retain non-range tasks in an optional unscheduled lane.
3. Dragging a bar moves both endpoints; resizing a handle changes one endpoint.
   Preview and queue the exact resulting dates through the central mutation
   layer.
4. Add color modes (project, tag, priority, neutral) consistent with calendar
   range cards and ensure sufficient contrast.

Acceptance: overlapping ranges remain legible, timezone conversion cannot
shift a bar one day, and undo/rollback restores both endpoints.

### 5. Safe bulk operations

1. Add keyboard and pointer multi-select to board, calendar and timeline with
   a persistent selection count and “clear selection”.
2. Support batch project, tag, priority, date, completion/reopen and deletion.
   Deletion/date clearing always require a preview and explicit confirmation.
3. Implement a bounded-concurrency mutation queue with per-task result states;
   do not lose the whole batch because one task fails.
4. Write an operation manifest and outcome report under `.ticktick/reports/`.
   Include IDs, timestamps, before/after fields and errors, never secrets.

Acceptance: preview counts are exact, partial failures are recoverable, and
the report identifies every attempted task.

### 6. Weekly review and execution dashboard

1. Build a cache-only weekly review: completed, overdue, moved, unscheduled
   tasks and most-used tags. Specify the week as Saturday through Friday.
2. Add preview-first actions for moving overdue tasks, clearing the weekly
   plan and creating the next week’s plan. Each action routes through bulk
   operations and shares their report/rollback behavior.
3. Include “data as of” and a manual sync button; do not silently refresh or
   block initial rendering.

Acceptance: metrics are reproducible from a fixed cache fixture, and every
action can be reviewed before a remote mutation starts.

### 7. Experimental hierarchy, subtasks and estimates

1. First add read-only display of parent/child relationships, blocked-by
   links, estimates and project progress if fields are present in cache.
2. Build an isolated fixture/probe project and document exact observed API
   payloads and IDs in a non-secret developer report.
3. Keep all writes behind an off-by-default experimental setting. Add only
   after the probe verifies create, reorder, completion and rollback behavior.
4. Never expose an enabled write control when an API field is ambiguous or an
   operation cannot be journaled.

Acceptance: release builds default to read-only hierarchy; enabling writes
requires the explicit setting and confirmation per probe scope.

## Implementation milestones

| Milestone | Primary files | Tests | Release gate |
| --- | --- | --- | --- |
| Smart views | `core/project-board.js`, `obsidian/project-board.ts` | selector/board tests | Cache-only rail works offline |
| Shared views | core filter module, planner/board UI, settings | filter parity tests | Saved view round-trip |
| Backlog | calendar core/UI, main mutation layer | drop/rollback tests | No date offset or full reload |
| Timeline | new timeline core/UI/style module | range layout/mutation tests | Endpoint update/rollback |
| Bulk + review | mutation queue, storage, dashboard | previews/reports/metrics tests | Exact audit trail |
| Experimental hierarchy | adapter/cache/settings | fixture probe tests | Read-only by default |

## Validation commands

Run after each milestone and before release:

```powershell
npm test
npm run check
npm run build
npm run deploy -- "E:\puria\Obsidian Vault"
```

Manual checks: open all views offline after a successful sync; compare smart
view counts to source tasks; test RTL and Jalali boundaries; use touch and
mouse scrolling; verify filter persistence after restart; force one remote
mutation failure; inspect `.ticktick/reports/` for secret-free audit data.

## Completion criteria

This roadmap is complete only when phases 1--6 are cache-first, responsive on
desktop/tablet, fully tested, and deployed. Phase 7 remains explicitly
experimental until a documented API probe graduates it. Every change is
committed independently and the release build is copied into the Obsidian
vault after its verification suite passes.
