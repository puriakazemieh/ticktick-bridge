import { App, Modal, Notice, Setting } from "obsidian";
import type { TickTickProject, SavedView, TaskFilterState } from "../types";

export interface CreateSmartViewModalOptions {
  projects: TickTickProject[];
  tags: string[];
  onSave: (view: SavedView) => Promise<void>;
}

export class CreateSmartViewModal extends Modal {
  private viewName = "";
  private selectedProjects: string[] = [];
  private selectedTags: string[] = [];
  private selectedPriority = -1; // -1 means all
  private selectedStatus = 0; // 0: open, 1: completed, -1: all
  private selectedGrouping = "project"; // "project" | "priority" | "date"

  constructor(app: App, private options: CreateSmartViewModalOptions) {
    super(app);
  }

  onOpen() {
    this.modalEl.addClass("ticktick-create-smart-view-modal");
    this.modalEl.style.direction = "rtl";

    this.titleEl.setText("✨ ساخت نمای هوشمند جدید");

    this.contentEl.createEl("p", {
      cls: "ticktick-modal-desc",
      text: "یک نمای هوشمند سفارشی با ترکیب فیلترهای دلخواه ایجاد کنید تا در نوار کناری برد همیشه در دسترس باشد."
    });

    // 1. Name input
    new Setting(this.contentEl)
      .setName("نام نمای هوشمند")
      .setDesc("نامی مشخص برای این نما (مثلاً: فوری‌های توسن تکنو).")
      .addText(text => {
        text.setPlaceholder("مثال: کارهای با اولویت بالا")
          .setValue(this.viewName)
          .onChange(val => { this.viewName = val; });
        text.inputEl.dir = "rtl";
        setTimeout(() => text.inputEl.focus(), 50);
        text.inputEl.addEventListener("keydown", e => {
          if (e.key === "Enter") {
            e.preventDefault();
            void this.submit();
          }
        });
      });

    // 2. Project filter
    const projectSetting = new Setting(this.contentEl)
      .setName("پروژه‌ها / لیست‌ها")
      .setDesc("انتخاب پروژه‌های خاص یا همهٔ پروژه‌ها.");
    const projContainer = projectSetting.controlEl.createDiv({ cls: "ticktick-smart-filter-chips" });
    const allProjChip = projContainer.createSpan({
      cls: `ticktick-filter-choice-chip ${this.selectedProjects.length === 0 ? "is-selected" : ""}`,
      text: "همهٔ پروژه‌ها"
    });
    allProjChip.onclick = () => {
      this.selectedProjects = [];
      updateProjectChips();
    };

    const projectChipsMap = new Map<string, HTMLElement>();
    const updateProjectChips = () => {
      allProjChip.toggleClass("is-selected", this.selectedProjects.length === 0);
      for (const [pId, chip] of projectChipsMap.entries()) {
        chip.toggleClass("is-selected", this.selectedProjects.includes(pId));
      }
    };

    for (const p of this.options.projects) {
      const chip = projContainer.createSpan({
        cls: `ticktick-filter-choice-chip ${this.selectedProjects.includes(String(p.id)) ? "is-selected" : ""}`,
        text: p.name
      });
      chip.onclick = () => {
        const id = String(p.id);
        if (this.selectedProjects.includes(id)) {
          this.selectedProjects = this.selectedProjects.filter(x => x !== id);
        } else {
          this.selectedProjects.push(id);
        }
        updateProjectChips();
      };
      projectChipsMap.set(String(p.id), chip);
    }

    // 3. Tags filter (if any)
    if (this.options.tags.length > 0) {
      const tagSetting = new Setting(this.contentEl)
        .setName("برچسب‌ها")
        .setDesc("فیلتر بر اساس یک یا چند برچسب.");
      const tagContainer = tagSetting.controlEl.createDiv({ cls: "ticktick-smart-filter-chips" });
      const allTagsChip = tagContainer.createSpan({
        cls: `ticktick-filter-choice-chip ${this.selectedTags.length === 0 ? "is-selected" : ""}`,
        text: "همهٔ برچسب‌ها"
      });
      allTagsChip.onclick = () => {
        this.selectedTags = [];
        updateTagChips();
      };

      const tagChipsMap = new Map<string, HTMLElement>();
      const updateTagChips = () => {
        allTagsChip.toggleClass("is-selected", this.selectedTags.length === 0);
        for (const [tName, chip] of tagChipsMap.entries()) {
          chip.toggleClass("is-selected", this.selectedTags.includes(tName));
        }
      };

      for (const t of this.options.tags) {
        const chip = tagContainer.createSpan({
          cls: `ticktick-filter-choice-chip ${this.selectedTags.includes(t) ? "is-selected" : ""}`,
          text: `#${t}`
        });
        chip.onclick = () => {
          if (this.selectedTags.includes(t)) {
            this.selectedTags = this.selectedTags.filter(x => x !== t);
          } else {
            this.selectedTags.push(t);
          }
          updateTagChips();
        };
        tagChipsMap.set(t, chip);
      }
    }

    // 4. Priority selector
    const prioSetting = new Setting(this.contentEl)
      .setName("اولویت")
      .setDesc("فیلتر بر اساس اولویت تسک.");
    const prioContainer = prioSetting.controlEl.createDiv({ cls: "ticktick-smart-filter-chips" });
    const prioOptions = [
      { label: "همهٔ اولویت‌ها", val: -1 },
      { label: "بالا 🚩", val: 5 },
      { label: "متوسط 🚩", val: 3 },
      { label: "کم 🚩", val: 1 },
      { label: "عادی", val: 0 },
    ];
    for (const opt of prioOptions) {
      const chip = prioContainer.createSpan({
        cls: `ticktick-filter-choice-chip ${this.selectedPriority === opt.val ? "is-selected" : ""}`,
        text: opt.label
      });
      chip.onclick = () => {
        this.selectedPriority = opt.val;
        for (const sibling of Array.from(prioContainer.children)) {
          (sibling as HTMLElement).toggleClass("is-selected", sibling === chip);
        }
      };
    }

    // 5. Status selector
    new Setting(this.contentEl)
      .setName("وضعیت تسک‌ها")
      .setDesc("نمایش کارهای باز یا تمام‌شده.")
      .addDropdown(dd => {
        dd.addOption("0", "فقط کارهای باز (ناتمام)")
          .addOption("1", "فقط کارهای انجام‌شده")
          .addOption("-1", "همهٔ تسک‌ها (باز و انجام‌شده)")
          .setValue(String(this.selectedStatus))
          .onChange(val => { this.selectedStatus = Number(val); });
      });

    // 6. Grouping selector
    new Setting(this.contentEl)
      .setName("چیدمان ستون‌های کانبان")
      .setDesc("ستون‌ها بر چه اساسی در این نما دسته‌بندی شوند.")
      .addDropdown(dd => {
        dd.addOption("project", "بر اساس پروژه / لیست")
          .addOption("priority", "بر اساس اولویت")
          .addOption("date", "بر اساس تاریخ سررسید")
          .setValue(this.selectedGrouping)
          .onChange(val => { this.selectedGrouping = val; });
      });

    const buttonContainer = this.contentEl.createDiv({ cls: "modal-button-container" });
    const cancelBtn = buttonContainer.createEl("button", { text: "انصراف" });
    cancelBtn.addEventListener("click", () => this.close());

    const saveBtn = buttonContainer.createEl("button", {
      text: "ذخیره نمای هوشمند",
      cls: "mod-cta"
    });
    saveBtn.addEventListener("click", () => void this.submit());
  }

  private async submit() {
    const trimmed = this.viewName.trim();
    if (!trimmed) {
      new Notice("لطفاً یک نام برای نمای هوشمند وارد کنید.");
      return;
    }

    const filter: TaskFilterState = {
      projects: this.selectedProjects,
      tags: this.selectedTags,
      priorities: this.selectedPriority >= 0 ? [this.selectedPriority] : [],
      statuses: this.selectedStatus >= 0 ? [this.selectedStatus] : [],
      dateRange: null,
      searchText: "",
      grouping: this.selectedGrouping,
      sort: "ticktick"
    };

    const newView: SavedView = {
      id: `sv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: trimmed,
      scope: "board",
      filter,
      grouping: this.selectedGrouping,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await this.options.onSave(newView);
      this.close();
    } catch (err) {
      new Notice(err instanceof Error ? err.message : "ذخیره نمای هوشمند ناموفق بود.");
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}
