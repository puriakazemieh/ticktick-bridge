import { ItemView, Notice, WorkspaceLeaf, setIcon } from "obsidian";
import { CONTROL_VIEW_TYPE } from "../constants";
import type { ControlScreen } from "../types";
import type TickTickBridgePlugin from "../main";

export class TickTickControlView extends ItemView {
  private screen: ControlScreen = "sync";

  constructor(leaf: WorkspaceLeaf, private plugin: TickTickBridgePlugin) {
    super(leaf);
  }

  getViewType() { return CONTROL_VIEW_TYPE; }
  getDisplayText() { return "مرکز کنترل TickTick"; }
  getIcon() { return "sliders-horizontal"; }
  getState() { return { screen: this.screen }; }
  async setState(state: { screen?: ControlScreen }) {
    this.screen = state?.screen ?? "sync";
    await this.render();
  }

  async onOpen() { await this.render(); }

  async render() {
    this.contentEl.empty();
    this.contentEl.addClass("ticktick-control-page");

    // ── Segmented Navigation Bar ──
    const nav = this.contentEl.createDiv({ cls: "ticktick-control-nav" });
    const choices: Array<[ControlScreen, string, string]> = [
      ["sync", "همگام‌سازی", "arrow-down-up"],
      ["notes", "TickTick Notes", "file-text"],
      ["checklists", "Checklist", "list-checks"],
      ["reports", "گزارش‌ها", "bar-chart-2"]
    ];

    for (const [screen, label, iconName] of choices) {
      const button = nav.createEl("button", {
        cls: `ticktick-control-tab ${this.screen === screen ? "is-active" : ""}`,
        attr: { type: "button" }
      });
      const icon = button.createSpan({ cls: "ticktick-tab-icon" });
      setIcon(icon, iconName);
      button.createSpan({ text: label });
      button.addEventListener("click", () => {
        this.screen = screen;
        void this.render();
      });
    }

    // ── Content Card ──
    const card = this.contentEl.createDiv({ cls: "ticktick-control-card" });

    if (this.screen === "sync") {
      const header = card.createDiv({ cls: "ticktick-control-header" });
      const hIcon = header.createSpan({ cls: "ticktick-header-icon" });
      setIcon(hIcon, "arrow-down-up");
      header.createEl("h2", { text: "همگام‌سازی و تعارض‌ها" });

      card.createEl("p", {
        cls: "ticktick-control-desc",
        text: "همگام‌سازی کامل همهٔ لیست‌ها و رکوردها را بدون فیلتر تاریخ دریافت و محلی cache می‌کند. Preview هیچ تغییری نمی‌نویسد؛ Apply فقط پس از انتخاب شما اجرا می‌شود."
      });
      if (this.plugin.cacheConflictCount()) {
        card.createEl("p", { cls: "ticktick-control-desc", text: `${this.plugin.cacheConflictCount()} تغییر محلی نیازمند تصمیم است؛ از دکمهٔ «باز کردن تعارض‌ها» برای دیدن و مدیریت آن‌ها استفاده کن.` });
      }

      const actions = card.createDiv({ cls: "ticktick-control-actions" });
      this.button(actions, "همگام‌سازی کامل TickTick", "refresh-cw", async () => this.plugin.syncNow(), true);
      this.button(actions, "Preview Markdown", "file-search", async () => this.plugin.previewMarkdownSync());
      this.button(actions, "Apply Preview", "upload-cloud", async () => this.plugin.applyMarkdownSync());
      this.button(actions, "باز کردن تعارض‌ها", "git-pull-request", async () => this.plugin.openMarkdownSyncConflicts(), false, true);

    } else if (this.screen === "notes") {
      const header = card.createDiv({ cls: "ticktick-control-header" });
      const hIcon = header.createSpan({ cls: "ticktick-header-icon" });
      setIcon(hIcon, "file-text");
      header.createEl("h2", { text: "انتقال انتخابی TickTick Notes" });

      card.createEl("p", {
        cls: "ticktick-control-desc",
        text: "فقط Noteهای دارای kind: NOTE پس از انتخاب شما وارد فولدر TickTick Notes می‌شوند؛ فایل‌های موجود overwrite نمی‌شوند."
      });

      const actions = card.createDiv({ cls: "ticktick-control-actions" });
      this.button(actions, "انتخاب و انتقال Noteها", "file-text", async () => this.plugin.previewTickTickNotes(), true);

    } else if (this.screen === "checklists") {
      const header = card.createDiv({ cls: "ticktick-control-header" });
      const hIcon = header.createSpan({ cls: "ticktick-header-icon" });
      setIcon(hIcon, "list-checks");
      header.createEl("h2", { text: "Checklist و Subtask" });

      card.createEl("p", {
        cls: "ticktick-control-desc",
        text: "Checklistها در کارت task نمایش داده می‌شوند اما فعلاً فقط‌خواندنی‌اند؛ ویرایش child item تا تأیید رسمی API TickTick فعال نمی‌شود."
      });

      const actions = card.createDiv({ cls: "ticktick-control-actions" });
      this.button(actions, "باز کردن تسک‌های امروز", "calendar-check", async () => this.plugin.openTodayView(), true);

    } else {
      const header = card.createDiv({ cls: "ticktick-control-header" });
      const hIcon = header.createSpan({ cls: "ticktick-header-icon" });
      setIcon(hIcon, "bar-chart-2");
      header.createEl("h2", { text: "گزارش‌ها و پشتیبان‌گیری" });

      const latest = await this.plugin.latestManagedReport();
      if (latest?.path) {
        const badgeRow = card.createDiv({ cls: "ticktick-report-badge-row" });
        badgeRow.createSpan({ cls: "ticktick-report-badge", text: `آخرین گزارش: ${latest.path}` });
      } else {
        card.createEl("p", { cls: "ticktick-control-desc", text: "هنوز گزارشی ایجاد نشده است." });
      }

      if (latest?.report) {
        const pre = card.createEl("pre", { cls: "ticktick-report-pre" });
        pre.setText(JSON.stringify(latest.report, null, 2));
      }
    }
  }

  private button(
    parent: HTMLElement,
    label: string,
    iconName: string,
    action: () => Promise<any>,
    cta = false,
    danger = false
  ) {
    const button = parent.createEl("button", {
      cls: `ticktick-control-btn ${cta ? "mod-cta" : ""} ${danger ? "mod-danger" : ""}`,
      attr: { type: "button" }
    });
    const btnIcon = button.createSpan({ cls: "ticktick-btn-icon" });
    setIcon(btnIcon, iconName);
    button.createSpan({ text: label });

    button.addEventListener("click", async () => {
      button.disabled = true;
      btnIcon.addClass("is-spinning");
      try {
        await action();
      } catch (error) {
        new Notice(error instanceof Error ? error.message : "عملیات ناموفق بود.");
      } finally {
        button.disabled = false;
        btnIcon.removeClass("is-spinning");
      }
    });
  }
}
