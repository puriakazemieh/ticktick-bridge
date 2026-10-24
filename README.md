# TickTick Bridge

A standalone TickTick task bridge for your vault. It syncs TickTick projects,
tasks, and habits without bundling any account token or personal data.

## Installation

Download `main.js`, `manifest.json`, and `styles.css` from the matching GitHub
release and place them in `.obsidian/plugins/ticktick-bridge/`. Enable the
plugin from Community plugins, then enter your own TickTick API token in its
settings.

## Usage

Open the Today or Habits view from the ribbon or Command Palette. Add a
`ticktick-today` or `ticktick-habits` code block to a note to render the
corresponding dashboard inline.

### Safe Markdown sync

Use **Preview Markdown ↔ TickTick sync** before **Apply Markdown ↔ TickTick sync**. A tagged task is bound only after TickTick returns its task and project IDs, using a hidden public marker such as `<!-- ticktick-bridge:task id=… project=… v=1 -->`. Preview performs no writes. Conflicts, ambiguous creates, missing remote tasks, and duplicate bindings are quarantined for review; the plugin never retries an ambiguous create automatically.

### Weekly planner

Open **TickTick weekly planner** or add a `ticktick-planner` code block to a note. The planner has day, week, and 42-cell month views, uses the configured timezone for placement, and reads the cached task list until you request a refresh. Dragging is enabled only for a task with a verified Markdown binding. Every move asks for confirmation, re-reads the TickTick task, creates a `.ticktick` snapshot/report, and preserves multi-day duration. Recurring task occurrences are deliberately not moved by drag-and-drop; edit the series in TickTick instead.

### Project board

Open **TickTick project board** or use a `ticktick-board` code block for a sidebar of documented TickTick lists and a horizontal kanban board. A returned folder/group is used as a display filter; unavailable group metadata falls back to a flat list. List projects without remote columns show a display-only `Tasks` column. Card order and cross-column/project dragging are intentionally read-only until the official API behavior is characterized. Completing a card is available only when its Markdown binding has been verified and uses the safe sync path.

### Local habits

Set the local habit folder in settings (default: `برنامه‌ریزی/Habits`) and run **Review local habits for TickTick migration**. The preview is read-only, reports unsupported fields and duplicate names, and writes a managed report. Local history stays visible in the unified habit dashboard and is never overwritten. Habit creation and historical check-in import remain disabled until TickTick provides a verified official endpoint; no local habit file is deleted or changed.

## Managed local storage

The plugin keeps recoverable, non-secret managed artifacts under
`.ticktick/`: dated snapshots in `backups/YYYY-MM-DD/`, operation reports in
`reports/`, and recoverable journals in `journal/`. `notes/` is reserved for
future managed notes. Snapshot retention is exactly ten UTC calendar days
(today plus the preceding nine); it never uses file modification time.

To recover, copy a dated JSON snapshot out of `.ticktick/backups/` before
inspecting or restoring its public task/habit metadata. Snapshots and reports
never contain API tokens, web-session tokens, cookies, raw request headers, or
passwords.

The settings button **Move legacy root backups** previews only root-level
`ticktick-backup-*.csv` files. After confirmation each is copied to the safe
legacy variant `.ticktick/backups/legacy-root/`, byte length is checked, and
only then is its root copy removed. A failed copy leaves the source in place.
Future managed writers must use the storage service rather than write artifacts
to the vault root.

---

هستهٔ مستقل برای اتصال امن Obsidian به TickTick، بدون وابستگی به TickTickSync.

## هدف

- دریافت پروژه‌ها و تسک‌ها با API Token شخصی TickTick
- افزودن، ویرایش، حذف و تکمیل تسک
- تکمیل درستِ تسک تکرارشونده با endpoint اختصاصی TickTick؛ تاریخ نوبت بعدی را خود TickTick تعیین می‌کند
- نمایش تسک‌های امروز و عقب‌افتاده در Obsidian
- نمایش و ثبت عادت‌های امروز TickTick، در پنل جداگانه یا داخل روزنوشت
- نگاشت کنترل‌شدهٔ فایل‌های پروژه به پروژه‌های TickTick، بدون ساختن تسک تکراری
- فراهم‌کردن Provider جداگانه برای عادت‌های محلی و TickTick

## وضعیت اولیه

نسخهٔ فعلی شامل پنل «تسک‌های امروز»، پنل «عادت‌های امروز»، افزودن/ویرایش/حذف تسک و بلوک‌های روزنوشت است. نگاشت خودکار فایل‌های قدیمی پروژه به TickTick عمداً هنوز فعال نشده است تا تسک تکراری ساخته نشود.

## اجرا برای توسعه

```powershell
npm install
npm run check
npm test
npm run build
npm run deploy -- "E:\puria\Obsidian Vault"
```

این دستور فایل‌های استاندارد افزونه (`main.js`، `manifest.json` و `styles.css`) را در `.obsidian/plugins/ticktick-bridge` Vault کپی می‌کند. سپس در Obsidian از بخش **Community plugins**، افزونهٔ TickTick Bridge را فعال کن و در تنظیمات آن API Token را وارد و «اتصال را بررسی کن» را بزن. توکن فقط در تنظیمات افزونه ذخیره می‌شود و هرگز داخل فایل‌های Markdown یا این مخزن نوشته نمی‌شود.

## نمایش داخل روزنوشت

بعد از نصب افزونه، این بلوک را در تمپلت روزانه قرار بده:

````markdown
```ticktick-today
```
````

بلوک، تسک‌های امروز و عقب‌افتاده را نمایش می‌دهد و تیک‌زدنِ تسک تکراری را با endpoint اختصاصی TickTick انجام می‌دهد.

## نمایش عادت‌ها

برای نمایش عادت‌های همان روز در روزنوشت، این بلوک را اضافه کن:

````markdown
```ticktick-habits
```
````

تیک‌زدن یک عادت، ثبت همان روز را در TickTick انجام می‌دهد. پنل مستقل عادت‌ها نیز از آیکن افزونه یا Command Palette در دسترس است.
