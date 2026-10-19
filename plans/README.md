# TickTick Bridge — implementation plans

Generated on 2026-10-14 against commit `b86e322`. Execute in this order. Each executor must read its entire plan, run its drift check, honour STOP conditions, and update this index when finished.

## Execution order & status

| Plan | Title | Priority | Effort | Depends on | Status |
|---|---|---:|---:|---|---|
| 001 | Isolate managed TickTick data and retain ten days of backups | P0 | M | — | TODO |
| 002 | Synchronize bound Markdown tasks safely in both directions | P0 | L | 001 | TODO |
| 003 | Add an interactive weekly and monthly planning calendar | P1 | L | 001, 002 | TODO |
| 004 | Present projects and folders as TickTick-style Kanban boards | P1 | L | 001, 002 | TODO |
| 005 | Ship experimental checklist and subtask editing behind a safety gate | P2 | L | 001, 002 | TODO |
| 006 | Migrate local habits and unify the habit dashboard | P2 | M | 001 | TODO |
| 007 | Import selected TickTick Notes into managed Obsidian files | P2 | L | 001 | TODO |

Status values: `TODO` | `IN PROGRESS` | `DONE` | `BLOCKED` (include a reason) | `REJECTED` (include a reason).

## Dependency notes

- Plan 001 establishes the only location for snapshots, reports, journals, and generated content: `/.ticktick/` in the vault. Every later writer must use it rather than writing to the vault root.
- Plan 002 supplies durable task bindings, field baselines, conflict reporting, and safe write primitives. Calendar, Kanban, and checklist writes must call these primitives, never call `TickTickClient` directly.
- Plans 003 and 004 may be developed in parallel after Plan 002, but their UI commands and view types must be registered without collisions.
- Plan 005 deliberately follows Plan 002: checklist item IDs are not stable enough to treat as ordinary task fields without a durable operation journal.

## Product decisions fixed by this plan set

- The hidden user-visible data folder is `/.ticktick/`; it is created lazily, is not treated as a Markdown source, and contains no token, password, or web session cookie.
- Keep backups whose UTC capture date is within the most recent **10 calendar days**, including today. Retention applies only inside `/.ticktick/backups/`; it must never delete an arbitrary root CSV.
- First write to a Markdown file, a remote task, a checklist, or a migrated habit/note must be previewed and explicitly confirmed. The legacy root backup CSVs are migrated only through a one-time, confirmable command.
- Kanban uses TickTick project columns when they exist. Ordinary list projects get a single `Tasks` column; folder rows are navigation/filter groupings, not a second remote hierarchy.
- Experimental checklist editing remains disabled by default until the official API behavior is characterized against a disposable corpus.

## Findings considered and rejected

- Replacing the TickTick web app with a webview: rejected. It would duplicate the existing TickTick Panel approach and would not create safe local bindings, calendar writes, or migration history.
- Writing managed data in the vault root: rejected. Existing `ticktick-backup-*.csv` files already clutter the root and make retention/error boundaries ambiguous.
