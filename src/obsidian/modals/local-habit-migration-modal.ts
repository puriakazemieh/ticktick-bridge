import { App, Modal, Notice, TFile } from "obsidian";
import { isLocalHabit, parseLocalHabit, previewHabitMigration } from "../../core/local-habit.js";

export interface DiscoveredLocalHabit {
  file: TFile;
  habit: ReturnType<typeof parseLocalHabit>;
  preview: ReturnType<typeof previewHabitMigration>;
}

export class LocalHabitMigrationModal extends Modal {
  private discovered: DiscoveredLocalHabit[] = [];
  private selectedPaths = new Set<string>();

  constructor(app: App) {
    super(app);
  }

  async onOpen() {
    this.contentEl.empty();
    this.contentEl.addClass("ticktick-local-habit-modal");

    this.contentEl.createEl("h2", { text: "مرور عادت‌های محلی و پیش‌نمایش مهاجرت" });
    const intro = this.contentEl.createEl("p", {
      text: "عادت‌های ذخیره‌شده در والت بررسی شدند. انتقال مستقیم به TickTick تا زمان تأیید رسمی API مسدود است و فایل‌های محلی شما دست‌نخورده باقی می‌مانند."
    });
    intro.addClass("ticktick-control-desc");

    const loading = this.contentEl.createDiv({ text: "در حال جستجوی عادت‌های محلی والت..." });

    try {
      await this.discoverHabits();
      loading.remove();
      this.renderHabitList();
    } catch (error) {
      loading.setText(`خطا در خواندن فایل‌های عادت: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async discoverHabits() {
    this.discovered = [];
    const files = this.app.vault.getMarkdownFiles();
    for (const file of files) {
      if (file.path.startsWith(".ticktick")) continue;
      // prioritize files in Habits/ or archiv/Habits/ or files with habit: true
      const isCandidatePath = file.path.includes("Habit") || file.path.includes("عادت");
      if (isCandidatePath || file.stat.size < 50000) {
        try {
          const content = await this.app.vault.read(file);
          if (isLocalHabit(content)) {
            const habit = parseLocalHabit(content, { path: file.path, fallbackTitle: file.basename });
            if (habit) {
              const preview = previewHabitMigration(habit);
              this.discovered.push({ file, habit, preview });
            }
          }
        } catch {
          // ignore unreadable files safely
        }
      }
    }
  }

  private renderHabitList() {
    if (!this.discovered.length) {
      this.contentEl.createDiv({
        cls: "ticktick-empty-state",
        text: "هیچ فایل عادت محلی با ساختار frontmatter معتبر پیدا نشد."
      });
      return;
    }

    const listContainer = this.contentEl.createDiv({ cls: "ticktick-local-habit-list" });

    for (const item of this.discovered) {
      const { habit, preview } = item;
      const row = listContainer.createDiv({ cls: "ticktick-local-habit-row" });

      const check = row.createEl("input", {
        type: "checkbox",
        attr: { "aria-label": `انتخاب ${habit?.name}` }
      });
      check.checked = this.selectedPaths.has(item.file.path);
      check.addEventListener("change", () => {
        if (check.checked) this.selectedPaths.add(item.file.path);
        else this.selectedPaths.delete(item.file.path);
      });

      const body = row.createDiv({ cls: "ticktick-local-habit-info" });
      const header = body.createDiv({ cls: "ticktick-local-habit-header" });
      if (habit?.icon) header.createSpan({ text: habit.icon + " " });
      header.createEl("strong", { text: habit?.name ?? item.file.basename });

      if (habit?.sectionName) {
        header.createSpan({ cls: "ticktick-habit-tag", text: habit.sectionName });
      }

      const meta = body.createDiv({ cls: "ticktick-local-habit-meta" });
      meta.createSpan({ text: `نوع: ${habit?.type === "repetition" ? "تکرار" : "دودویی"} · هدف: ${habit?.goal} ${habit?.unit || ""}` });
      meta.createSpan({ text: ` | مسیر: ${item.file.path}` });

      if (preview?.losses.length) {
        const lossBox = body.createDiv({ cls: "ticktick-local-habit-losses" });
        for (const loss of preview.losses) {
          lossBox.createDiv({ text: `⚠️ ${loss}` });
        }
      }

      if (preview?.isBlocked) {
        const gateBox = body.createDiv({ cls: "ticktick-local-habit-gate" });
        gateBox.createDiv({ text: `🔒 ${preview.blockReason}` });
      }
    }

    const actions = this.contentEl.createDiv({ cls: "modal-button-container" });
    const closeBtn = actions.createEl("button", { text: "بستن", cls: "mod-cta" });
    closeBtn.addEventListener("click", () => this.close());
  }

  onClose() {
    this.contentEl.empty();
  }
}
