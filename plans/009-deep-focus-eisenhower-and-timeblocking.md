# Plan 009: Deep focus, Eisenhower decision matrix, and daily timeblocking workspace

> Status: DONE  
> Priority: P1  
> Effort: Large  
> Risk: Medium  
> Planned: 2026-11-02  
> Depends on: Plans 001–008, local cache, bounded queue, selection store, and Daily Note integration

## Goal

Extend the cache-first planning foundation delivered in Plan 008 into an active execution workspace. Provide visual decision tools (Eisenhower 2×2 matrix), interactive daily timeblocking, an integrated Pomodoro focus engine with automatic Jalali Daily Note session logging, natural language quick capture (Persian & English), and visual productivity heatmaps.

---

## Architectural Principles & Integration Points

1. **Cache-First & Local-Only Instant Reads**:
   - Every view (Matrix, Timeblocking, Pomodoro, Heatmap) must read initially from the in-memory `cache.tasks` and `cache.habits` without triggering network round-trips.
2. **Safe Bounded Mutations**:
   - Any drag-and-drop between quadrants or time slots routes through the established `executeBulkOperation` and `runBoundedQueue` pipeline, producing audit reports in `.ticktick/reports/`.
3. **Daily Note Preservation & Markdown Integrity**:
   - Focus session logging strictly appends under user-configured markdown headings in existing Jalali daily notes without overwriting other content or introducing format corruption.
4. **Natural Language Parsing without Heavy Runtimes**:
   - Build a lightweight, pure-regex NLP parser supporting both Persian (e.g. `فردا ساعت ۵ عصر #کاری !1`) and English date/priority tokens.
5. **RTL & Persian Calendar First-Class Citizen**:
   - All visual layouts, time grids, heatmaps, and quadrant badges must support RTL natively with Tehran time zone alignment.

---

## Delivery Order & Milestones

### Milestone 1: Eisenhower Decision Matrix (ماتریس اولویت‌بندی آیزنهاور ۲×۲) [DONE]

1. **Pure Engine (`src/core/eisenhower-matrix.js`)**:
   - Compute 4 quadrants from tasks:
     - **Q1: Do First (فوری و مهم)**: Priority 5 (High) and (due today, overdue, or due within 2 days).
     - **Q2: Schedule (مهم، غیرفوری)**: Priority 5 or 3 (High/Medium) and (due in future > 2 days or unscheduled).
     - **Q3: Delegate (فوری، غیرمهم)**: Priority 1 or 0 (Low/None) and (due today or overdue).
     - **Q4: Eliminate / Backlog (نه فوری و نه مهم)**: Priority 0 and no due date.
   - `computeQuadrantDropMutation(task, targetQuadrant, today)`:
     - Dropping into Q1 sets priority 5 and due today.
     - Dropping into Q2 sets priority 5 and leaves date or schedules next week.
     - Dropping into Q3 sets priority 1 and due today.
     - Dropping into Q4 clears date and resets priority to 0.
2. **Visual Matrix Component (`src/obsidian/eisenhower-matrix.ts`)**:
   - Glassmorphic 2×2 grid with custom color accents.
   - Full drag-and-drop support across quadrants with optimistic card re-ordering.
   - Bulk selection support (`BulkActionBar` mounted).
   - Register view: `TickTick: Open Eisenhower Matrix` (`ticktick-bridge-matrix`).
   - Register codeblock processor: ````ticktick-matrix````.
3. **Acceptance Criteria**:
   - Dragging a task between quadrants updates both priority and schedule in cache and queues bounded mutation.
   - View renders instantly offline.

---

### Milestone 2: Daily Timeblocking Agenda (برنامه‌ریز و بلوک‌بندی زمانی روزانه) [DONE]

1. **Pure Engine (`src/core/timeblocking.js`)**:
   - `computeDayTimeSlots(tasks, targetDay, startHour = 7, endHour = 23, slotMinutes = 30)`:
     - Maps timed tasks to exact grid positions (rowStart, rowSpan).
     - Detects overlapping blocks and computes lane packing (similar to timeline lane packing).
     - Identifies unassigned tasks for today (tasks with date but no specific time).
2. **Visual Day Planner (`src/obsidian/timeblocking-planner.ts`)**:
   - Vertical timeline grid with current time indicator line (red horizontal rule).
   - Side drawer / backlog strip showing today's untimed tasks.
   - Dragging task onto a time slot assigns `dueDate` time component (e.g. `2026-11-03T10:30:00+0330`).
   - Bottom handle drag-resizes block duration (30m, 45m, 60m, 90m, 120m).
   - Status Bar Item:
     - Displays active timeblock task: `در حال انجام: [عنوان] (تا ۱۲:۰۰)`.
   - Register view: `TickTick: Open Day Planner & Timeblocks`.
   - Register codeblock processor: ````ticktick-day-planner````.
3. **Acceptance Criteria**:
   - Moving or resizing a block preserves date, updates ISO time stamp, and does not erase task descriptions.

---

### Milestone 3: Focus & Pomodoro Engine with Daily Note Auto-Logging (موتور پومودورو و لاگ خودکار در یادداشت روزانه) [DONE]

1. **Pure Timer & Logging Engine (`src/core/pomodoro-engine.js`)**:
   - State machine: `idle` | `focus` | `shortBreak` | `longBreak` | `paused`.
   - Configurable intervals (default: 25m focus, 5m short break, 15m long break, 4 pomodoros per cycle).
   - `formatPomodoroLogEntry(session)`:
     - Produces clean markdown line: `- 🍅 ۲۵ دقیقه: [عنوان تسک] (ساعت ۱۴:۳۰)` or link to task binding.
2. **UI & Daily Note Integration (`src/obsidian/pomodoro-timer.ts`)**:
   - Floating glassmorphic mini-widget + Status Bar display (`🍅 24:59 [تسک X]`).
   - Start / Pause / Reset / Skip controls.
   - Selecting any task from Board, Calendar, or Matrix exposes "شروع پومودورو برای این تسک".
   - On completed focus session:
     - Increments `task.pomodoroCount` in cache and queues sync update.
     - Appends log line into today's Jalali Daily Note under heading (default: `## جلسات تمرکز (Pomodoro)`).
     - Plays subtle audio chime (if enabled) and triggers Obsidian notice.
3. **Acceptance Criteria**:
   - Timer continues accurately even if user switches leaves.
   - Markdown log appends safely to the correct daily note without file corruption.

---

### Milestone 4: Natural Language Smart Quick-Add (ثبت سریع با پردازش زبان طبیعی فارسی و انگلیسی) [DONE]

1. **Pure NLP Parser (`src/core/nlp-parser.js`)**:
   - `parseTaskNaturalLanguage(input, options = { today, timeZone })`:
     - **Dates (Persian)**: "امروز", "فردا", "پس‌فردا", "شنبه بعد", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه".
     - **Dates (English)**: "today", "tomorrow", "next monday", etc.
     - **Times**: "ساعت ۵ عصر", "ساعت ۱۰:۳۰", "17:00", "5pm", "9am".
     - **Priority**: `!1` or `!high` (5), `!2` or `!med` (3), `!3` or `!low` (1), `!0` (0).
     - **Tags**: `#tag1 #tag2`.
     - **Project**: `~پروژه` or `@پروژه`.
     - **Clean Title**: Strips parsed tokens leaving only the actual task title.
2. **Quick Capture Modal (`src/obsidian/modals/quick-capture-modal.ts`)**:
   - High-contrast minimal modal with instant live-parsing chips preview:
     - Chips row shows: `📅 فردا`, `⏰ ۱۷:۰۰`, `🚩 بالا`, `#کاری`, `📁 پروژه وب`.
   - Pressing `Enter` calls `createTask` via mutation queue and closes modal in < 100ms.
   - Command: `TickTick: Quick Capture Task (Natural Language)`.
3. **Acceptance Criteria**:
   - Parser passes test suite with 20+ Persian and English phrase variations.
   - Does not misparse normal title words containing numbers.

---

### Milestone 5: Activity & Habit Heatmap Dashboard (هیت‌مپ فعالیت و ردگیری پیوستگی) [DONE]

1. **Pure Heatmap Matrix Engine (`src/core/activity-heatmap.js`)**:
   - `computeAnnualHeatmapData(tasks, habits, options = { year, timeZone })`:
     - Compiles day-by-day score (completed tasks count + habit check-ins count).
     - Computes intensity level (0 to 4).
     - Computes current streak, longest streak, and total completed this year.
2. **Visual Heatmap Grid (`src/obsidian/activity-heatmap.ts`)**:
   - Interactive SVG/CSS grid organized by week columns (Saturday to Friday).
   - Tooltip on hover showing exact tasks and habits completed on that day.
   - Embeddable codeblock: ````ticktick-heatmap````.
3. **Acceptance Criteria**:
   - Heatmap renders 365/366 days in < 15ms from cache.
   - Correctly maps Jalali months and weekdays.

---

## Test & Release Gates

```powershell
npm test
npm run check
npm run build
npm run deploy -- "E:\puria\Obsidian Vault"
```

Manual checks:
- Verify Eisenhower matrix drag-drop updates remote task without page reload.
- Verify timeblock resizing preserves task notes and time stamps.
- Verify Pomodoro completion logs entry into daily note without destroying existing headings.
- Verify NLP parser handles Persian phrases correctly without false positives.
