# Plan 004: Present projects and folders as TickTick-style Kanban boards

> **Executor instructions**: Build the requested UI from TickTick project data, not from screenshot pixels. Follow Plans 001 and 002 for persistence and writes. No direct remote write from a card handler is permitted.
>
> **Drift check (run first)**: `git diff --stat b86e322..HEAD -- src/core/ticktick-client.js src/obsidian/main.ts styles.css test`

## Status

- **Status**: Complete on `main` (2026-10-24)
- **Priority**: P1
- **Effort**: L
- **Risk**: MED — moving cards can alter project/column/order assignments.
- **Depends on**: `plans/001-managed-storage-and-backups.md`, `plans/002-safe-bidirectional-markdown-sync.md`
- **Category**: direction / project UI
- **Planned at**: commit `b86e322`, 2026-10-14

## Why this matters

The user wants the familiar TickTick experience shown in the provided images: a left rail of folders/lists with counts and colored dots, and a per-project board with columns, priority grouping, cards, dates, tags, and checkboxes. Current Bridge only shows Today, Habits, and a recurring-task board; it fetches project data internally but does not expose project navigation or `columnId` UI. The board should complement, not replace, TickTick's remote organization.

## Current state

- `TickTickClient.getProjectData(projectId)` at `src/core/ticktick-client.js:49` returns a project plus `tasks` and `columns`; `listOpenTasks` currently flattens tasks and drops columns/project metadata needed by a board.
- `main.ts:577-590` enriches web tasks with project names; `renderRecurringBlock` at lines 851 onward is the closest existing multi-column task UI.
- `scripts/sync-project-tasks.mjs:50-85` already recognizes `columnId` for old project mapping, but it is a standalone script and must not be used by the runtime UI.
- Project folders/groups are not reliably exposed by the current official client. The sidebar must gracefully render flat projects unless a documented group field is returned.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Tests | `npm test` | all pass |
| Typecheck | `npm run check` | exit 0 |
| Build | `npm run build` | exit 0 |

## Scope

**In scope**:

- `src/core/project-board.js` (new), `src/core/ticktick-client.js`
- `src/obsidian/main.ts`, `src/obsidian/project-board.ts` (new)
- `styles.css`
- `test/project-board.test.js` (new), `test/client.test.js`
- `README.md`

**Out of scope**:

- Creating/deleting remote projects, folders, or columns.
- Assuming unsupported project-group endpoints, embedding TickTick web UI, or desktop-only webviews.
- Checklist editing (Plan 005) and a separate database for board state.

## Steps

### Step 1: Preserve board-shaped project data

Extend the client with a typed/project-data normalization helper returning `{ project, columns, tasks }`, keeping `projectId`, `projectName`, `projectColor`, `columnId`, `columnName`, priority, tags, dates, and completion state. Create pure `project-board.js` functions to make a sidebar tree and board columns. When data has no supported folder/group identity, return flat projects; when a project has no columns, synthesize one local display-only `Tasks` column. Never synthesize a remote ID.

Group task cards within each column by priority in the user-facing order: Pinned (if available), High, Medium, Low, No priority, Completed (collapsed/opt-in). Preserve remote `sortOrder` inside each group.

**Verify**: tests cover flat projects, nested returned groups, list projects, empty columns, missing `columnId`, and Persian sorting.

### Step 2: Build project navigation and board views

Register `ticktick-bridge-project-board`, command "Open TickTick project board", and `ticktick-board` code block. The view has a compact collapsible left rail: folder/list rows, color dot, open-task count, selected row, and an "All lists" aggregate. Selecting a folder is a filter; selecting a project opens its board. Persist only local UI preferences (collapsed sidebar nodes, last selected project) in plugin settings, not a remote hierarchy.

Render a horizontally scrollable, RTL-friendly board. Each column header shows name/count; task cards show completion checkbox, title, short description excerpt, priority treatment with non-color cue, tags, due date, recurrence indicator, and source-note link if bound. Provide a task editor and a no-op/error state for offline cache.

**Verify**: `npm run check` → exit 0; manually render a list-mode project and a multi-column project from fixture data.

### Step 3: Add guarded card actions and drag behavior

Checkbox, edit, and delete actions delegate to Plan 002. Dragging within a column changes local display order only until the official API move/order behavior is independently characterized; show a tooltip that ordering is read-only in v1. Dragging to a different existing column opens a preview/confirmation only if the official task update preserves a tested `columnId`; otherwise disable cross-column drop with an explanation. Dragging to another project is likewise disabled until a documented, tested project-move contract exists.

The confirmation flow must fresh-read, snapshot, report, and conflict-check. Never infer a project/folder relationship from display grouping. Add a board refresh command; it uses normal sync and preserves selection/scroll where practical.

**Verify**: fake-client tests show no remote request for reordering; a disabled uncharacterized column move cannot write; a supported confirmed move produces one Plan 002 update.

### Step 4: Polish accessibility and document scope

Implement keyboard focus, visible selected state, aria labels for counts/colors, tooltips for truncated description/date, narrow-screen horizontal navigation, and empty states. Document that folders are a filter, list projects get a `Tasks` column, and remote column/order writes are deliberately gated by API characterization.

**Verify**: `npm test && npm run check && npm run build` → all succeed.

## Test plan

- Board data mapping, priority groups, project colors/counts, and malformed API fields.
- Sidebar selection/collapse preference serialization.
- Bound/unbound card display and offline cached data.
- Confirmed versus cancelled card actions; no writes for unverified ordering/moves.

## Done criteria

- [x] Project/list sidebar resembles the requested hierarchy and works when no remote folder metadata exists.
- [x] Each project is rendered as real TickTick columns or a single display-only `Tasks` column.
- [x] Cards expose all requested core information without color-only meaning.
- [x] Cross-column/project writes are disabled unless officially characterized and routed through Plan 002.
- [x] `npm test`, `npm run check`, and `npm run build` pass.

## STOP conditions

- STOP if required project-folder data is available only through a private API.
- STOP if `columnId` update/move behavior cannot be confirmed with a disposable project.
- STOP if card drag would overwrite a task baseline or bypass conflict resolution.

## Maintenance notes

Keep board data normalization independent from DOM rendering so future project group support is additive. The visual target is information hierarchy—counts, columns, priority groups, card metadata—not a brittle replica of TickTick's proprietary UI.
