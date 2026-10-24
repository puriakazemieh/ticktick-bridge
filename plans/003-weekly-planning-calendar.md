# Plan 003: Add an interactive weekly and monthly planning calendar

> **Executor instructions**: This plan assumes Plans 001 and 002 are DONE. Calendar writes must call the safe sync engine, must produce a pre-write snapshot, and must never mutate an unbound task directly.
>
> **Drift check (run first)**: `git diff --stat b86e322..HEAD -- src/obsidian/main.ts src/core/date.js src/core/ticktick-client.js styles.css test`

## Status

- **Status**: Complete on `main` (2026-10-24)
- **Priority**: P1
- **Effort**: L
- **Risk**: MED — drag interactions change dates/times and can introduce timezone errors.
- **Depends on**: `plans/001-managed-storage-and-backups.md`, `plans/002-safe-bidirectional-markdown-sync.md`
- **Category**: direction / planning UI
- **Planned at**: commit `b86e322`, 2026-10-14

## Why this matters

The current Today view filters cached tasks by date (`isScheduledForDay` in `src/core/date.js`) and the habit dashboard already has day/week/month navigation, but there is no planning horizon for tasks. The requested experience is a weekly planner where tasks can be read across days and deliberately rescheduled, with a monthly overview for load. It must respect `Asia/Tehran`, all-day data, Jalali daily notes, and TickTick recurrence semantics.

## Current state

- `main.ts:611-619` opens Today and Habits `ItemView`s; task view type is `ticktick-bridge-today`.
- `main.ts:621-706` renders an inline Today task grid; it creates/updates/completes/deletes directly through plugin methods.
- `src/core/date.js:1-70` supplies timezone-safe Gregorian date keys and Jalali daily-note conversion; its tests cover Tehran-boundary behavior.
- `main.ts:1260-1289` serializes all-day due dates and reminder triggers; do not replace it with browser-local date math.
- TickTick task project data contains start/due dates and project columns; do not call undocumented task-filter or private web APIs for the first version.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Tests | `npm test` | all pass |
| Typecheck | `npm run check` | exit 0 |
| Build | `npm run build` | exit 0 |

## Scope

**In scope**:

- `src/core/calendar-range.js` (new), `src/core/date.js`
- `src/obsidian/main.ts`, `src/obsidian/planning-calendar.ts` (new)
- `styles.css`
- `test/calendar-range.test.js` (new), `test/date.test.js`
- `README.md`

**Out of scope**:

- Google/ICS calendar integration, events, Pomodoro, time tracking, and private TickTick calendar endpoints.
- Creating a separate local task database or bypassing Plan 002 bindings.
- Full sub-hour scheduling; first release supports all-day and one optional start/reminder time consistent with current editor.

## Steps

### Step 1: Create a pure planning-range model

Add `calendar-range.js` to construct seven-day Monday-to-Sunday (configurable first weekday) and month grids from an ISO day using `todayInZone`/`toDateKey`. Split tasks into: all-day tasks, timed tasks, overdue unscheduled tasks, recurring active occurrences, and completed tasks (hidden by default). Supply stable sort order: pinned/order where available, then time, priority, title. Include a 42-cell month grid and overflow counts without rendering DOM.

Use noon UTC only as a safe date iterator; render labels with `fa-IR-u-ca-persian` but use Gregorian ISO keys for TickTick API writes. Test the Nowruz/Jalali conversion boundary already used by `date.test.js`.

**Verify**: `npm test -- --test-name-pattern="calendar"` → range tests pass.

### Step 2: Register a dedicated planning view and inline block

Add `ticktick-bridge-planner` `ItemView`, Command Palette command "Open TickTick weekly planner", and `ticktick-planner` Markdown code block. UI has Day / Week / Month tabs, previous / Today / next controls, a clear sync status, and project/tag filter chips. Week shows seven RTL-aware day columns; month shows compact date cells and task count/preview. The planner reads cache first, then invokes normal sync/refresh; it must render an empty/offline state without causing requests in a loop.

Keep component lifecycle cleanup in the style of existing `ItemView`s and re-render only when a calendar signature changes. Add CSS using unique `ticktick-planner-*` class names and Obsidian variables; do not copy TickTick assets.

**Verify**: `npm run check` → exit 0; manually open both view and code block without duplicate leaves or console errors.

### Step 3: Make rescheduling explicit and safe

Add drag/drop only for a bound task or a remote task that has been freshly read by the sync engine. Dropping onto a date opens a confirmation popover showing old/new start/due, all-day/timed state, and recurrence warning. It must call a `rescheduleBoundTask` API in Plan 002, which snapshots, fresh-reads, applies a field-level date diff, and records a report.

For a recurrence, do not edit the active occurrence after ticking it complete; allow only an explicit "edit series" action through the task editor and warn that it edits TickTick's `repeatFlag`. Dragging an overdue task sets the selected day; dragging a multi-day task preserves duration after confirmation. Keyboard-only alternative: open editor with the target date prefilled.

**Verify**: fake-client tests assert one bound task update with Tehran date serialization; a cancelled confirmation performs zero writes; recurrence completion still uses dedicated complete endpoint.

### Step 4: Add review-oriented affordances and documentation

Include per-day counters (open/overdue/completed if enabled), priority color with text/icon fallback, project name, tags, and a link to source Markdown when bound. Document planner behaviors, timezone choices, write confirmation, and known limits. Add a setting to choose first day of week and whether completed tasks are shown; default to Monday and hidden completed tasks.

**Verify**: `npm test && npm run check && npm run build` → all succeed.

## Test plan

- Week/month bounds across Gregorian month/year and Jalali New Year boundaries.
- All-day vs timed serialization in Asia/Tehran and a daylight-saving-zone fixture.
- Overdue and multi-day placement; recurrence visibility without local next-date calculation.
- Filter state, no task duplication on rerender, cancelled and confirmed drag actions.

## Done criteria

- [x] Week, month, and inline planner render cached tasks with timezone-correct day placement.
- [x] A date move is confirmable, snapshot-backed, and uses the Plan 002 write path.
- [x] Planner opens without changing any task until the user confirms a write.
- [x] `npm test`, `npm run check`, and `npm run build` pass.

## STOP conditions

- STOP if TickTick's current API cannot preserve both time and all-day semantics for a tested update.
- STOP if drag/drop would need to invent recurrence occurrences locally.
- STOP if a planner write cannot identify a bound task/baseline and therefore cannot be reconciled safely.

## Maintenance notes

Kanban will share project/task filters but not calendar geometry. Review timezone regressions particularly around `toDateKey`, and keep date labels localized without localizing stored API keys.
