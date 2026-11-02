import { App, Modal, Notice, setIcon } from "obsidian";
import { parseTaskNaturalLanguage } from "../../core/nlp-parser.js";
import { todayInZone } from "../../core/date.js";
import type { TickTickProject, TickTickTask } from "../types";

export interface QuickCaptureHost {
  projects: () => Promise<TickTickProject[]> | TickTickProject[];
  timeZone: string;
  createTask: (payload: Partial<TickTickTask>) => Promise<any>;
}

export class QuickCaptureModal extends Modal {
  private projects: TickTickProject[] = [];
  private inputEl!: HTMLInputElement;
  private chipsEl!: HTMLElement;
  private hintsEl!: HTMLElement;
  private isSubmitting = false;

  constructor(app: App, private host: QuickCaptureHost) {
    super(app);
  }

  async onOpen() {
    this.modalEl.addClass("ticktick-quick-capture-modal");
    this.titleEl.setText("ثبت سریع تسک (پردازش زبان طبیعی)");

    try {
      this.projects = await Promise.resolve(this.host.projects());
    } catch {
      this.projects = [];
    }

    this.render();
  }

  onClose() {
    this.contentEl.empty();
  }

  private render() {
    this.contentEl.empty();
    const root = this.contentEl.createDiv({ cls: "ticktick-quick-capture-container" });

    // Input field
    this.inputEl = root.createEl("input", {
      type: "text",
      cls: "ticktick-quick-capture-input",
      placeholder: "مثلاً: جلسه با تیم فردا ساعت ۵ عصر !1 #کاری @پروژه"
    });

    // Chips Preview Container
    this.chipsEl = root.createDiv({ cls: "ticktick-quick-capture-chips" });

    // Hints Guide
    this.hintsEl = root.createDiv({ cls: "ticktick-quick-capture-hints" });
    this.hintsEl.createDiv({
      text: "💡 کلیدواژه‌های هوشمند قابل استفاده:",
      cls: "ticktick-quick-capture-hint-title"
    });

    const tokens = this.hintsEl.createDiv({ cls: "ticktick-quick-capture-hint-tokens" });
    tokens.createSpan({ cls: "ticktick-quick-token-badge", text: "فردا / پس‌فردا / شنبه بعد" });
    tokens.createSpan({ cls: "ticktick-quick-token-badge", text: "ساعت ۵ عصر / 17:00 / 9am" });
    tokens.createSpan({ cls: "ticktick-quick-token-badge", text: "!1 (بالا) / !2 (متوسط) / !3 (کم)" });
    tokens.createSpan({ cls: "ticktick-quick-token-badge", text: "#برچسب" });
    tokens.createSpan({ cls: "ticktick-quick-token-badge", text: "@پروژه یا ~پروژه" });

    // Actions Row
    const actions = root.createDiv({ cls: "ticktick-quick-capture-actions" });

    const cancelBtn = actions.createEl("button", {
      cls: "ticktick-quick-capture-btn-cancel",
      text: "انصراف"
    });
    cancelBtn.addEventListener("click", () => this.close());

    const submitBtn = actions.createEl("button", {
      cls: "ticktick-quick-capture-btn-primary",
      text: "ثبت تسک (Enter)"
    });
    submitBtn.addEventListener("click", () => void this.handleSubmit());

    // Event listeners
    this.inputEl.addEventListener("input", () => this.updateChips());
    this.inputEl.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void this.handleSubmit();
      }
    });

    // Auto-focus input
    window.setTimeout(() => this.inputEl.focus(), 50);
  }

  private updateChips() {
    this.chipsEl.empty();
    const val = this.inputEl.value.trim();
    if (!val) return;

    const today = todayInZone(this.host.timeZone);
    const parsed = parseTaskNaturalLanguage(val, {
      today,
      timeZone: this.host.timeZone,
      projects: this.projects
    });

    for (const chip of parsed.chips) {
      const chipEl = this.chipsEl.createSpan({
        cls: `ticktick-quick-chip is-${chip.type}`
      });
      const iconSpan = chipEl.createSpan();
      switch (chip.type) {
        case "date":
          setIcon(iconSpan, "calendar");
          break;
        case "time":
          setIcon(iconSpan, "clock");
          break;
        case "priority":
          setIcon(iconSpan, "alert-circle");
          break;
        case "project":
          setIcon(iconSpan, "folder");
          break;
        case "tag":
          setIcon(iconSpan, "hash");
          break;
      }
      chipEl.createSpan({ text: chip.label });
    }
  }

  private async handleSubmit() {
    if (this.isSubmitting) return;
    const val = this.inputEl.value.trim();
    if (!val) {
      new Notice("لطفاً عنوان تسک را وارد کنید.");
      return;
    }

    const today = todayInZone(this.host.timeZone);
    const parsed = parseTaskNaturalLanguage(val, {
      today,
      timeZone: this.host.timeZone,
      projects: this.projects
    });

    if (!parsed.title) {
      new Notice("عنوان معتبری برای تسک پیدا نشد.");
      return;
    }

    this.isSubmitting = true;
    try {
      const payload: Partial<TickTickTask> = {
        title: parsed.title,
        dueDate: parsed.dueDate,
        isAllDay: parsed.isAllDay,
        priority: parsed.priority,
        tags: parsed.tags,
        projectId: parsed.projectId || undefined,
        timeZone: this.host.timeZone
      };

      await this.host.createTask(payload);
      new Notice(`تسک «${parsed.title}» با موفقیت در TickTick ثبت شد.`);
      this.close();
    } catch (err) {
      new Notice(err instanceof Error ? err.message : "ثبت تسک ناموفق بود.");
      this.isSubmitting = false;
    }
  }
}
