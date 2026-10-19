# Plan 006: Migrate local habits and unify the habit dashboard

> **Executor instructions**: Plan 001 must be complete. Treat local habit frontmatter/history as user data: preview every migration and never delete or overwrite a source habit file as part of the first release.
>
> **Drift check (run first)**: `git diff --stat b86e322..HEAD -- src/core/habit-provider.js src/core/ticktick-client.js src/obsidian/main.ts test styles.css`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED — historical check-ins and cadence mapping can be lossy.
- **Depends on**: `plans/001-managed-storage-and-backups.md`
- **Category**: migration / dashboard
- **Planned at**: commit `b86e322`, 2026-10-14

## Why this matters

`AUDIT.md` records five local habits in `برنامه‌ریزی/Habits/`, while the initial connected TickTick account returned no habits. The code already has a separate `HabitProvider` abstraction and a polished TickTick history dashboard (day/week/month), but `LocalHabitProvider` only returns a list and cannot sync or merge. A migration wizard plus a source-aware dashboard lets the user keep local habits offline, move selected habits to TickTick safely, and review both without silently changing history.

## Current state

- `src/core/habit-provider.js:1-19` defines `HabitProvider` and a minimal `LocalHabitProvider`.
- `TickTickClient` lists habits/sections, queries check-ins, and posts a daily check-in (`src/core/ticktick-client.js:62-143`).
- `main.ts:714-850` renders current TickTick habits, day/week/month history dots, sections and click-to-check-in behavior.
- The cache fetches up to 90 days of remote check-ins at `main.ts:308-334`.
- Local habit file schema/history is not yet parsed by this repository; inspect representative files before assuming frontmatter fields.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Tests | `npm test` | all pass |
| Typecheck | `npm run check` | exit 0 |
| Build | `npm run build` | exit 0 |

## Scope

**In scope**:

- `src/core/local-habit.js` (new), `src/core/habit-provider.js`, `src/core/ticktick-client.js`
- `src/obsidian/main.ts`, `src/obsidian/habit-migration.ts` (new)
- `test/local-habit.test.js` (new), `test/client.test.js`
- `styles.css`, `README.md`

**Out of scope**:

- Deleting local habit files, changing their existing dashboard/plugin, social/community habits, or web-session/private API expansion.
- Automatic migration on startup.

## Steps

### Step 1: Discover and formalize the local-habit source contract

Inspect several actual files in the configured local habit directory without changing them. Implement a parser that explicitly supports only observed frontmatter/Markdown fields (name, cadence, goal/unit, section/group, exclusions, dated completion/value history). For unsupported fields, surface a "needs mapping" preview row rather than guessing. Add a path setting with default `برنامه‌ریزی/Habits/`; exclude `.ticktick/` and arbitrary Vault scans.

Extend `LocalHabitProvider` to return normalized daily/historical entries and a source identity; do not write through it yet.

**Verify**: parser fixtures include Persian names, Boolean/counter goals, weekly schedule, historical completion, malformed frontmatter, and unsupported record.

### Step 2: Build a preview-first migration wizard

Add "Review local habits" and "Migrate selected habits to TickTick" commands/settings. The preview maps each source field to the documented TickTick Habit payload, displays losses/assumptions, allows section assignment, duplicate match/unmatched choice, and has unchecked rows by default. On Apply, snapshot each source record and requested remote payload under `.ticktick/backups/`, then create only selected remote habits and store a local mapping registry under the Plan 001 managed data folder.

Do not import old check-ins in the first release unless the official API probe confirms historical stamps can be posted without corrupting streaks. If unavailable, preserve local history read-only and mark TickTick history as starting on migration date.

**Verify**: fake-client tests ensure preview creates zero habits; confirmed selected rows create exactly those rows and persist mappings; duplicate detection requires user choice.

### Step 3: Render unified source-aware dashboard

Evolve `renderHabitBlock` and `TodayHabitsView` to show source filter: All, TickTick, Local, and Linked. Keep existing day/week/month navigators, history dots, streak, section grouping, and Tehran date semantics. Each card identifies source in text/icon, offers the valid action (remote check-in, local read-only or local check-in only when separately enabled), and links to its source file. Avoid combining two records solely by matching names; only persisted migration mappings create a Linked habit.

Add summary tiles for planned/completed/missed and per-source counts. Cache remote and local data independently so offline local habits still display.

**Verify**: fixtures prove two identically named sources remain separate, a mapping unifies only its pair, and a remote check-in cannot write a local file.

### Step 4: Add optional local writeback only after migration is stable

Behind a separate default-off setting, allow checking a local card to update only the observed source-history format with an immediate source-file backup. Do not turn it on automatically as part of migration. Document no-history-import limitation, rollback through snapshots, and source semantics.

**Verify**: `npm test && npm run check && npm run build` → all succeed.

## Test plan

- Local parser for each supported type/cadence and invalid input.
- Preview, selected-only migration, duplicate/link choices, source snapshot, and restart mapping reload.
- Unified display with offline remote cache and local-only habits.
- No remote historical writes unless capability is explicitly verified.

## Done criteria

- [ ] Migration is previewed, selected, snapshot-backed, and does not delete local files.
- [ ] Dashboard clearly distinguishes Local, TickTick, and Linked records.
- [ ] Unsupported local data is reported rather than guessed or dropped.
- [ ] `npm test`, `npm run check`, and `npm run build` pass.

## STOP conditions

- STOP if local habit files use multiple incompatible schemas that cannot be parsed conservatively.
- STOP if the official API cannot safely create the required habit type/cadence.
- STOP if historical import would alter an existing TickTick habit/streak without a verified isolated path.

## Maintenance notes

Keep providers independent. A future local-habit editor can be designed after the parser contract is stable; it must not turn the migration registry into the source of truth for user-authored files.
