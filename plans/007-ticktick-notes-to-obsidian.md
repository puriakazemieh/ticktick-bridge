# Plan 007: Import selected TickTick Notes into managed Obsidian files

> **Executor instructions**: This is a separate information-capture flow, not task sync. Begin only after Plan 001. Do not assume an API `kind: NOTE` contract is writable until it is characterized against a disposable account.
>
> **Drift check (run first)**: `git diff --stat b86e322..HEAD -- src/core/ticktick-client.js src/obsidian/main.ts test README.md`

## Status

- **Status**: Initial selective one-way import on `main` (2026-10-24). Refresh/conflict resolution awaits a documented NOTE read contract in a live disposable account.
- **Priority**: P2
- **Effort**: L
- **Risk**: MED — incorrect identification could turn task content into unwanted files.
- **Depends on**: `plans/001-managed-storage-and-backups.md`
- **Category**: direction / content migration
- **Planned at**: commit `b86e322`, 2026-10-14

## Why this matters

TickTick is useful for rapid mobile capture, while Obsidian is the long-term writing/archive space. The requested feature brings selected TickTick Notes into Markdown without mixing them into ordinary task views. Current Bridge treats all fetched task-shaped data as tasks and does not have a durable file binding or managed note folder; Plan 001 reserves `/.ticktick/notes/` for metadata, not user-facing note content.

## Current state

- `TickTickClient.listOpenTasks()` fetches every project `data` document and filters only `status === 0` (`src/core/ticktick-client.js:91-98`); it does not classify `kind`.
- `main.ts:308-334` caches remote task collection; `cleanTaskDescription` renders descriptions as Markdown in task UI.
- `AUDIT.md` says prior task markers may include an Obsidian return link, but there is no dedicated note importer.
- The official task model may include `kind`, `title`, `content`, `desc`, timestamps, tags, and project data; API read/write parity for NOTE must be characterized before enabling writeback.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Tests | `npm test` | all pass |
| Typecheck | `npm run check` | exit 0 |
| Build | `npm run build` | exit 0 |

## Scope

**In scope**:

- `src/core/ticktick-note.js` (new), `src/core/ticktick-client.js`
- `src/obsidian/main.ts`, `src/obsidian/note-import.ts` (new)
- `test/ticktick-note.test.js` (new), `test/client.test.js`
- `README.md`

**Out of scope**:

- Attachments/images, automatic import of every task/note, folder-wide deletion, private API endpoints, and bidirectional NOTE edits in v1.
- Writing imported content under `.ticktick/notes/`; that folder is metadata-only. User-facing notes require a visible configured folder.

## Steps

### Step 1: Characterize and normalize Note records

Add a disposable, explicitly confirmed read/probe path to determine which records in the documented project data are safely identifiable as `kind: NOTE`, and which fields retain multiline Markdown. Add pure `normalizeTickTickNote` that rejects records missing stable ID/title/kind and preserves raw Markdown content without interpreting checkbox-looking text as task completion. The normalizer must distinguish a NOTE from a TEXT/CHECKLIST task even when body text starts with `- [ ]`.

**Verify**: unit fixtures cover NOTE, TEXT, CHECKLIST, missing kind/ID, Markdown body, Persian/Unicode title, and duplicate titles.

### Step 2: Build a preview-first selective importer

Add settings for one visible destination folder, default `TickTick Notes`, plus a project/tag selector and an optional import tag such as `#obsidian`. Create an importer command that fetches candidates, shows title/project/modified time/content excerpt/destination collision, and keeps every row unchecked initially. Apply creates Markdown only for selected candidates.

Each created file contains frontmatter with public identity and provenance (`ticktickNoteId`, `ticktickProjectId`, `ticktickKind: NOTE`, `ticktickImportedAt`) and a managed boundary comment around imported content. User content outside the boundary is preserved by future updates. Write a metadata binding/report under `.ticktick/notes/`; snapshot intended file writes before applying. Use ID-based filename suffix or a collision-safe map—never title alone.

**Verify**: fake adapter/client test proves preview makes zero files; selected import creates stable filename/frontmatter/boundary; duplicate title has no collision.

### Step 3: Add one-way incremental refresh and conflict quarantine

The first public release is TickTick → Obsidian only. A refresh finds imported note IDs, compares remote content with stored baseline and managed region, and updates only when local managed region is unchanged. If user edited inside the managed region and remote also changed, do not overwrite: produce a conflict report, leave the file intact, and offer "Keep local", "Take TickTick", or "Copy remote as new note". A remote-deleted note is labeled/orphaned in frontmatter; it is never deleted from Obsidian automatically.

Add a sidebar/command list of imported notes, last sync time, conflicts, and source links. Do not integrate Notes into task cards or Today counts.

**Verify**: tests cover remote-only update, local-only edit, same-region conflict, user-owned trailing content preservation, remote deletion, and restart/reload binding.

### Step 4: Document boundaries and defer writeback

Document selector, storage locations, file schema, conflict behavior, and explicit one-way limitation. Add a visible "experimental import" label until a live characterization confirms reliability. Do not offer edit-back-to-TickTick. A future plan may add it only after a separate NOTE create/update/readback probe and conflict design.

**Verify**: `npm test && npm run check && npm run build` → all succeed.

## Test plan

- Strict Note classification and content preservation.
- Preview/selection/collision behaviors, file name safety on Windows, and Persian titles.
- Managed boundary synchronization, user-owned region preservation, conflict choices, and orphan behavior.
- Ensure task records are never imported as Notes solely because their description contains Markdown checkboxes.

## Done criteria

- [x] Only explicitly selected, positively identified TickTick Notes become Markdown files.
- [x] Imported user-facing files go to visible `TickTick Notes` (or user setting); metadata/reports go under `.ticktick/`.
- [ ] Refresh/conflict resolution awaits an explicitly characterized NOTE read contract.
- [x] `npm test`, `npm run check`, and `npm run build` pass.

## STOP conditions

- STOP if the official API cannot reliably distinguish a NOTE from a task record.
- STOP if importing requires private endpoints or raw session cookies.
- STOP if the desired destination folder conflicts with existing unmanaged Markdown files and safe ID binding cannot resolve it.

## Maintenance notes

The visible note folder is deliberately portable and Git-friendly; `.ticktick/notes/` is only durable metadata. Keep this feature separate from task sync so a capture note cannot accidentally become an actionable task.
