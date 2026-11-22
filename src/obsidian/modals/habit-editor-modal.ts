import { App, Modal, Notice, Setting } from "obsidian";
import type { TickTickHabit } from "../../types/ticktick";

export interface HabitSection {
  id: string;
  name: string;
}

export interface HabitDraft {
  id?: string;
  name: string;
  type: "Boolean" | "Real";
  goal: number;
  step: number;
  unit: string;
  repeatRule: string;
  sectionId?: string;
  color: string;
  iconRes: string;
  encouragement?: string;
}

export interface HabitEditorModalOptions {
  habit?: TickTickHabit;
  sections?: HabitSection[];
  onSave: (draft: HabitDraft) => Promise<void>;
  onDelete?: (habitId: string) => Promise<void>;
}

const PRESET_COLORS = [
  { label: "آبی روشن", value: "#7BC4FA" },
  { label: "فیروزه‌ای", value: "#A0EFED" },
  { label: "سبز", value: "#97E38B" },
  { label: "سبز دریایی", value: "#80F3CD" },
  { label: "آبی کلاسیک", value: "#4D8CF5" },
  { label: "مرجانی / قرمز", value: "#F87171" },
  { label: "طلایی / زرد", value: "#FBBF24" },
  { label: "بنفش", value: "#A78BFA" }
];

const PRESET_ICONS = [
  { id: "habit_general", glyph: "⚡", label: "عمومی" },
  { id: "habit_learn_language", glyph: "📚", label: "یادگیری و زبان" },
  { id: "habit_reading", glyph: "📖", label: "مطالعه و کتاب" },
  { id: "habit_stretch", glyph: "🏃", label: "ورزش و تندرستی" },
  { id: "habit_drink_water", glyph: "💧", label: "نوشیدن آب" },
  { id: "habit_early_sleep", glyph: "🌙", label: "خواب و استراحت" },
  { id: "habit_listen_music", glyph: "🎧", label: "موسیقی و پادکست" },
  { id: "habit_meditation", glyph: "🧘", label: "مدیتیشن و ذهن" },
  { id: "habit_coding", glyph: "💻", label: "کار و برنامه‌نویسی" }
];

const WEEKDAY_MAP: Array<{ code: string; label: string }> = [
  { code: "SA", label: "شنبه" },
  { code: "SU", label: "یکشنبه" },
  { code: "MO", label: "دوشنبه" },
  { code: "TU", label: "سه‌شنبه" },
  { code: "WE", label: "چهارشنبه" },
  { code: "TH", label: "پنجشنبه" },
  { code: "FR", label: "جمعه" }
];

export class HabitEditorModal extends Modal {
  private name = "";
  private type: "Boolean" | "Real" = "Boolean";
  private goal = 1;
  private step = 1;
  private unit = "Count";
  private sectionId = "";
  private color = "#7BC4FA";
  private iconRes = "habit_general";
  private encouragement = "";
  private frequencyType: "daily" | "workdays" | "custom" = "daily";
  private selectedWeekdays: Set<string> = new Set(["SA", "SU", "MO", "TU", "WE", "TH", "FR"]);
  private isSaving = false;

  constructor(app: App, private options: HabitEditorModalOptions) {
    super(app);
    const h = options.habit;
    if (h) {
      this.name = String(h.name ?? "");
      this.type = String(h.type).toLowerCase() === "real" ? "Real" : "Boolean";
      this.goal = Math.max(1, Number(h.goal ?? h.target ?? 1));
      this.step = Math.max(1, Number(h.step ?? 1));
      this.unit = String(h.unit ?? (this.type === "Real" ? "بار" : "Count"));
      this.sectionId = String(h.sectionId ?? "");
      this.color = String(h.color ?? "#7BC4FA");
      this.iconRes = String(h.iconRes ?? h.icon ?? "habit_general");
      this.encouragement = String(h.encouragement ?? "");

      // Parse repeat rule
      const rule = String(h.repeatRule ?? "").toUpperCase();
      if (rule.includes("BYDAY=")) {
        const match = rule.match(/BYDAY=([A-Z,]+)/);
        if (match) {
          const days = match[1].split(",");
          this.selectedWeekdays = new Set(days);
          if (days.length === 5 && ["SA", "SU", "MO", "TU", "WE"].every(d => days.includes(d))) {
            this.frequencyType = "workdays";
          } else if (days.length === 7) {
            this.frequencyType = "daily";
          } else {
            this.frequencyType = "custom";
          }
        }
      } else {
        this.frequencyType = "daily";
      }
    }
  }

  onOpen() {
    this.modalEl.addClass("ticktick-habit-editor-modal");

    this.titleEl.setText(this.options.habit ? "✏️ ویرایش عادت" : "✨ افزودن عادت جدید");

    this.render();
  }

  private render() {
    this.contentEl.empty();

    // 1. Habit Name
    new Setting(this.contentEl)
      .setName("نام عادت")
      .setDesc("عنوان واضح و مشخصی برای عادت انتخاب کنید.")
      .addText(text => {
        text.setPlaceholder("مثال: مطالعه روزانه، ورزش، یادگیری زبان...")
          .setValue(this.name)
          .onChange(val => { this.name = val; });
        text.inputEl.dir = "rtl";
        setTimeout(() => text.inputEl.focus(), 50);
      });

    // 2. Section / Category
    if (this.options.sections && this.options.sections.length > 0) {
      new Setting(this.contentEl)
        .setName("دسته‌بندی")
        .setDesc("دسته‌بندی عادت در TickTick")
        .addDropdown(dd => {
          dd.addOption("", "بدون دسته‌بندی");
          for (const sec of this.options.sections!) {
            dd.addOption(sec.id, sec.name);
          }
          dd.setValue(this.sectionId);
          dd.onChange(val => { this.sectionId = val; });
        });
    }

    // 3. Type Selection (Boolean vs Real)
    new Setting(this.contentEl)
      .setName("نوع ثبت عادت")
      .setDesc("آیا انجام ساده دارد یا شمارشی/چند مرحله‌ای است؟")
      .addDropdown(dd => {
        dd.addOption("Boolean", "ساده (انجام شد / نشد)");
        dd.addOption("Real", "شمارشی / چند مرحله‌ای");
        dd.setValue(this.type);
        dd.onChange(val => {
          this.type = val as "Boolean" | "Real";
          if (this.type === "Boolean") {
            this.goal = 1;
            this.step = 1;
            this.unit = "Count";
          } else if (this.unit === "Count") {
            this.unit = "بار";
            this.goal = 2;
          }
          this.render();
        });
      });

    // 4. Real Type Settings: Goal, Step, Unit
    if (this.type === "Real") {
      new Setting(this.contentEl)
        .setName("هدف روزانه")
        .setDesc("تعداد کل مراحل یا کمیت هدف در هر روز")
        .addText(text => {
          text.inputEl.type = "number";
          text.setValue(String(this.goal))
            .onChange(val => {
              const num = parseInt(val, 10);
              this.goal = Number.isNaN(num) || num < 1 ? 1 : num;
            });
        });

      new Setting(this.contentEl)
        .setName("گام هر ثبت")
        .setDesc("با هر بار کلیک، چه تعداد به پیشرفت اضافه شود؟")
        .addText(text => {
          text.inputEl.type = "number";
          text.setValue(String(this.step))
            .onChange(val => {
              const num = parseInt(val, 10);
              this.step = Number.isNaN(num) || num < 1 ? 1 : num;
            });
        });

      new Setting(this.contentEl)
        .setName("واحد شمارش")
        .setDesc("نام واحد (مانند: بار، دقیقه، صفحه، لیوان)")
        .addText(text => {
          text.setPlaceholder("مثال: بار، دقیقه، صفحه...")
            .setValue(this.unit)
            .onChange(val => { this.unit = val.trim() || "بار"; });
          text.inputEl.dir = "rtl";
        });
    }

    // 5. Repeat & Frequency
    new Setting(this.contentEl)
      .setName("تکرار و روزهای اجرا")
      .setDesc("عادت در چه روزهایی از هفته باید انجام شود؟")
      .addDropdown(dd => {
        dd.addOption("daily", "هر روز (تمام روزهای هفته)");
        dd.addOption("workdays", "روزهای کاری (شنبه تا چهارشنبه)");
        dd.addOption("custom", "روزهای سفارشی");
        dd.setValue(this.frequencyType);
        dd.onChange(val => {
          this.frequencyType = val as "daily" | "workdays" | "custom";
          if (this.frequencyType === "daily") {
            this.selectedWeekdays = new Set(["SA", "SU", "MO", "TU", "WE", "TH", "FR"]);
          } else if (this.frequencyType === "workdays") {
            this.selectedWeekdays = new Set(["SA", "SU", "MO", "TU", "WE"]);
          }
          this.render();
        });
      });

    // Custom weekdays selector if custom is chosen
    if (this.frequencyType === "custom") {
      const weekdaysWrap = this.contentEl.createDiv({ cls: "ticktick-habit-weekdays-picker" });
      weekdaysWrap.createEl("span", { cls: "ticktick-setting-label", text: "انتخاب روزها:" });
      const buttonsRow = weekdaysWrap.createDiv({ cls: "ticktick-habit-weekdays-row" });
      for (const day of WEEKDAY_MAP) {
        const isSelected = this.selectedWeekdays.has(day.code);
        const dayBtn = buttonsRow.createEl("button", {
          cls: `ticktick-weekday-pill ${isSelected ? "is-selected" : ""}`,
          text: day.label,
          attr: { type: "button" }
        });
        dayBtn.addEventListener("click", () => {
          if (this.selectedWeekdays.has(day.code)) {
            if (this.selectedWeekdays.size > 1) {
              this.selectedWeekdays.delete(day.code);
            } else {
              new Notice("حداقل یک روز باید انتخاب شده باشد.");
              return;
            }
          } else {
            this.selectedWeekdays.add(day.code);
          }
          this.render();
        });
      }
    }

    // 6. Color Selection
    const colorSetting = new Setting(this.contentEl)
      .setName("رنگ تم عادت")
      .setDesc("رنگ کارت و نشانگر پیشرفت در نماها");
    const colorGrid = colorSetting.controlEl.createDiv({ cls: "ticktick-habit-color-picker" });
    for (const c of PRESET_COLORS) {
      const isSel = this.color.toLowerCase() === c.value.toLowerCase();
      const dot = colorGrid.createEl("button", {
        cls: `ticktick-habit-color-dot ${isSel ? "is-selected" : ""}`,
        attr: { type: "button", title: c.label }
      });
      dot.style.backgroundColor = c.value;
      dot.addEventListener("click", () => {
        this.color = c.value;
        this.render();
      });
    }

    // 7. Icon Selection
    const iconSetting = new Setting(this.contentEl)
      .setName("آیکون عادت")
      .setDesc("نماد تصویری مربوط به عادت");
    const iconGrid = iconSetting.controlEl.createDiv({ cls: "ticktick-habit-icon-picker" });
    for (const item of PRESET_ICONS) {
      const isSel = this.iconRes === item.id;
      const btn = iconGrid.createEl("button", {
        cls: `ticktick-habit-icon-btn ${isSel ? "is-selected" : ""}`,
        attr: { type: "button", title: item.label }
      });
      btn.createSpan({ text: item.glyph });
      btn.addEventListener("click", () => {
        this.iconRes = item.id;
        this.render();
      });
    }

    // 8. Encouragement / Notes
    new Setting(this.contentEl)
      .setName("یادداشت و انگیزه (اختیاری)")
      .setDesc("جمله کوتاه انگیزشی یا جزئیات هدف")
      .addText(text => {
        text.setPlaceholder("مثال: ۲۰ صفحه قبل از خواب، پادکست آلمانی...")
          .setValue(this.encouragement)
          .onChange(val => { this.encouragement = val; });
        text.inputEl.dir = "rtl";
      });

    // 9. Actions Container
    const actionContainer = this.contentEl.createDiv({ cls: "modal-button-container ticktick-modal-actions-bar" });

    // Delete / Archive button if editing
    if (this.options.habit && this.options.onDelete) {
      const deleteBtn = actionContainer.createEl("button", {
        text: "🗑️ حذف / آرشیو عادت",
        cls: "mod-warning"
      });
      deleteBtn.addEventListener("click", async () => {
        const confirmDelete = window.confirm(`آیا از حذف/آرشیو عادت «${this.name || this.options.habit?.name}» مطمئن هستید؟`);
        if (!confirmDelete) return;

        deleteBtn.disabled = true;
        try {
          await this.options.onDelete!(String(this.options.habit!.id));
          this.close();
        } catch (err) {
          deleteBtn.disabled = false;
          new Notice(err instanceof Error ? err.message : "حذف عادت ناموفق بود.");
        }
      });
    }

    const cancelBtn = actionContainer.createEl("button", { text: "انصراف" });
    cancelBtn.addEventListener("click", () => this.close());

    const saveBtn = actionContainer.createEl("button", {
      text: this.options.habit ? "ذخیره تغییرات" : "ایجاد عادت",
      cls: "mod-cta"
    });
    saveBtn.addEventListener("click", () => void this.submit());
  }

  private buildRepeatRule(): string {
    if (this.frequencyType === "daily" || this.selectedWeekdays.size === 7) {
      return "RRULE:FREQ=DAILY;INTERVAL=1";
    }
    const days = Array.from(this.selectedWeekdays).join(",");
    return `RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=${days}`;
  }

  private async submit() {
    const cleanName = this.name.trim();
    if (!cleanName) {
      new Notice("لطفاً نام عادت را وارد کنید.");
      return;
    }

    if (this.isSaving) return;
    this.isSaving = true;

    const draft: HabitDraft = {
      id: this.options.habit?.id,
      name: cleanName,
      type: this.type,
      goal: this.type === "Boolean" ? 1 : Math.max(1, this.goal),
      step: this.type === "Boolean" ? 0 : Math.max(1, this.step),
      unit: this.type === "Boolean" ? "Count" : (this.unit || "بار"),
      repeatRule: this.buildRepeatRule(),
      sectionId: this.sectionId || undefined,
      color: this.color,
      iconRes: this.iconRes,
      encouragement: this.encouragement.trim() || undefined
    };

    try {
      await this.options.onSave(draft);
      this.close();
    } catch (err) {
      this.isSaving = false;
      new Notice(err instanceof Error ? err.message : "ذخیره عادت ناموفق بود.");
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}
