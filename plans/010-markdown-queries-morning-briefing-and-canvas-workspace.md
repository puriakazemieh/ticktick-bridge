# Plan 010: Dynamic query embeds, morning briefing, editor autocomplete, canvas board, and smart reminders

> Status: IN PROGRESS  
> Priority: P1  
> Effort: Large  
> Risk: Low to Medium  
> Planned: 2026-11-02  
> Depends on: Plans 001–009, local cache, bounded queue, Jalali calendar, and Web Audio synthesizer

## Goal

Bring the TickTick task ecosystem directly into the user's Obsidian writing flow. Enable users to query and embed live interactive tasks inside any markdown note (`ticktick-query`), run an intelligent Morning Briefing with one-click Daily Note synchronization, autocomplete and link tasks while writing with an in-editor suggester, export visual task boards into Obsidian Canvas (`.canvas`), and receive gentle native audio reminders for upcoming timed tasks.

---

## Architectural Principles & Integration Points

1. **Zero-Latency In-Memory Execution**:
   - Queries, morning briefing summaries, editor suggestions, and canvas exports read from the existing local cache (`cache.tasks`, `cache.habits`, `cache.projects`) without making external network calls.
2. **Safe Bounded Mutations from Embedded Checkboxes**:
   - Checkboxes inside `ticktick-query` codeblocks, morning briefings, or reminder notifications route directly to `executeBulkOperation` / `runBoundedQueue` so remote state, cache, and audit reports stay 100% consistent.
3. **Markdown & Daily Note Integrity**:
   - Daily note injections locate existing headings or append cleanly at the top/bottom without modifying unrelated sections, daily templates, or handwriting blocks.
4. **Persian & RTL Native Design**:
   - Query filters, briefings, autocomplete displays, and notices support Persian text, numbers, and Tehran time zone alignments seamlessly.
5. **No External Asset Dependencies**:
   - Canvas files use standard Obsidian JSON schema. Reminders use native Web Audio API oscillators for chime generation without external media files.

---

## Delivery Order & Milestones

### Milestone 1: Dynamic Query Embed Engine (`ticktick-query`) [DONE]
1. **Pure Engine (`src/core/query-engine.js`)**:
   - `parseQueryBlockSpec(yamlText)`: Extracts project, tags, priority filters (`0`, `1`, `3`, `5`, `>=3`), status (`uncompleted`, `completed`, `all`), due date ranges (`today`, `overdue`, `tomorrow`, `this-week`, `unscheduled`), sorting, and item limit.
   - `executeTaskQuery(tasks, spec, options = { today, timeZone })`: Evaluates in-memory tasks against parsed specification.
2. **Obsidian Codeblock Processor (`src/obsidian/query-block.ts`)**:
   - Registers `ticktick-query` codeblock renderer with live interactive checkboxes.
   - Supports 3 view layouts: `list`, `compact`, and `cards`.
   - Clicking a task checkbox triggers optimistic state change and queues bounded mutation.
3. **Acceptance Criteria**:
   - Fully passes query parser and filtering test suite.
   - Codeblock renders inside any Obsidian note in < 5ms.

---

### Milestone 2: Smart Morning Briefing & Daily Kickoff Generator (پیشخوان مرور صبحگاهی و کیک‌آف روزانه) [DONE]
1. **Pure Engine (`src/core/morning-briefing.js`)**:
   - `computeMorningBriefing(tasks, habits, options = { today, timeZone })`:
     - Compiles overdue tasks needing attention.
     - Chronological timeline of today's timed tasks.
     - Untimed high/medium priority tasks for today.
     - Scheduled habits for today.
     - Yesterday's completed victories summary.
   - `formatMorningBriefingMarkdown(briefing)`: Produces structured Persian/English Markdown.
   - `injectBriefingIntoDailyNote(existingContent, briefingMarkdown, heading)`: Safely replaces or inserts the briefing under a designated heading.
2. **Obsidian UI & Daily Note Integration (`src/obsidian/morning-briefing-modal.ts`)**:
   - Morning briefing popup modal and `ticktick-briefing` codeblock.
   - One-click action buttons: "انتقال معوقه‌ها به امروز" (Reschedule overdue to today) and "ثبت در دیلی‌نوت" (Append to today's Jalali daily note).
   - Command: `TickTick: Open morning briefing and daily kickoff`.
3. **Acceptance Criteria**:
   - Generates reproducible briefing data from cache fixtures.
   - Injects cleanly into Jalali daily notes without corrupting existing markdown or handwriting content.

---

### Milestone 3: In-Editor Quick Suggest & Task Autocomplete (`EditorSuggest`) [DONE]
1. **Pure Matcher (`src/core/editor-suggest-matcher.js`)**:
   - Detects trigger prefix (e.g. `[[tt:` or `@task:`) at cursor position.
   - Performs fuzzy search against cached active tasks with Persian character and diacritic normalization.
   - Generates insertion text (Markdown task links or compact task chips).
2. **Obsidian Editor Suggest Extension (`src/obsidian/editor-suggest.ts`)**:
   - Registers `EditorSuggest<TickTickTask>` with Obsidian app.
   - Renders suggestion popup showing priority flag, title, project badge, and due date.
   - In Live Preview and Reading mode, clicking a task link opens `TaskDetailsModal`.
3. **Acceptance Criteria**:
   - Triggers accurately only when typing the prefix.
   - Normalized Persian and English search matches reliably.

---

### Milestone 4: Visual Canvas Board Exporter (`ticktick-canvas`) [DONE]
1. **Pure Canvas Generator (`src/core/canvas-exporter.js`)**:
   - `generateCanvasFromTasks(tasks, options)`: Produces Obsidian `.canvas` JSON structure:
     - Nodes: Color-coded cards (High = red, Medium = orange/yellow, Low = blue, None = gray).
     - Column groupings: By Project, Eisenhower Quadrant, or Status.
     - Edges: Connects dependent tasks or subtasks.
2. **Obsidian Command (`src/obsidian/canvas-exporter.ts`)**:
   - Command: `TickTick: Export tasks to visual Obsidian Canvas`.
   - Prompts for file name or writes to `TickTick Tasks Board.canvas`.
   - Opens the canvas file automatically in Obsidian.
3. **Acceptance Criteria**:
   - Generates valid `.canvas` JSON compliant with Obsidian Canvas specification.
   - Node coordinates avoid overlaps and connect dependency edges correctly.

---

### Milestone 5: Smart Background Reminders & Audio Alerts (سیستم یادآوری صوتی و هشدارهای سررسید)
1. **Pure Daemon Logic (`src/core/reminder-daemon.js`)**:
   - `checkDueReminders(tasks, currentTime, acknowledgedIds, leadMinutes = 5)`: Identifies tasks needing reminder notifications.
   - Handles snooze mutations (`computeSnoozeMutation(task, minutes)`).
2. **Obsidian Background Service (`src/obsidian/reminder-service.ts`)**:
   - Runs lightweight interval check (every 30 seconds).
   - Synthesizes soft Web Audio alert chime.
   - Displays actionable Obsidian Notice with "انجام شد" (Mark Done) and "تعویق ۱۵ دقیقه" (Snooze 15m) buttons.
3. **Acceptance Criteria**:
   - Reminders trigger on time and only once per task occurrence.
   - Snoozing updates task due time via bounded mutation queue.

---

## Test & Release Gates

```powershell
npm test
npm run check
npm run build
npm run deploy -- "E:\puria\Obsidian Vault"
```
