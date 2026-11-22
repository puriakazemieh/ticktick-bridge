import { App, Modal } from "obsidian";
import { JalaliDatePicker } from "../components/jalali-date-picker";

export class BulkTagModal extends Modal {
  private resolveResult!: (value: { tag: string; action: "add" | "remove" } | null) => void;
  private result = new Promise<{ tag: string; action: "add" | "remove" } | null>(resolve => {
    this.resolveResult = resolve;
  });
  private finished = false;

  constructor(app: App, private count: number) {
    super(app);
  }

  finish(value: { tag: string; action: "add" | "remove" } | null) {
    if (!this.finished) {
      this.finished = true;
      this.resolveResult(value);
      this.close();
    }
  }

  onOpen() {
    this.modalEl.addClass("ticktick-bulk-input-modal");

    this.titleEl.setText(`مدیریت برچسب‌های ${this.count} تسک`);

    const inputWrapper = this.contentEl.createDiv({ cls: "ticktick-bulk-input-wrapper" });
    inputWrapper.createEl("label", { text: "نام برچسب:" });
    const tagInput = inputWrapper.createEl("input", {
      type: "text",
      placeholder: "مثال: فوری یا کار"
    });

    const buttonContainer = this.contentEl.createDiv({ cls: "modal-button-container" });
    
    const cancelBtn = buttonContainer.createEl("button", { text: "انصراف" });
    cancelBtn.addEventListener("click", () => this.finish(null));

    const removeBtn = buttonContainer.createEl("button", {
      text: "حذف از تسک‌ها",
      cls: "mod-warning"
    });
    removeBtn.addEventListener("click", () => {
      const tag = tagInput.value.trim().replace(/^#/, "");
      if (!tag) return;
      this.finish({ tag, action: "remove" });
    });

    const addBtn = buttonContainer.createEl("button", {
      text: "افزودن به تسک‌ها",
      cls: "mod-cta"
    });
    addBtn.addEventListener("click", () => {
      const tag = tagInput.value.trim().replace(/^#/, "");
      if (!tag) return;
      this.finish({ tag, action: "add" });
    });

    setTimeout(() => tagInput.focus(), 50);
  }

  onClose() {
    this.contentEl.empty();
    if (!this.finished) {
      this.finished = true;
      this.resolveResult(null);
    }
  }

  openAndWait() {
    this.open();
    return this.result;
  }
}

export class BulkDateModal extends Modal {
  private resolveResult!: (value: { targetDay: string; time?: string } | null) => void;
  private result = new Promise<{ targetDay: string; time?: string } | null>(resolve => {
    this.resolveResult = resolve;
  });
  private finished = false;

  constructor(app: App, private count: number, private defaultDay: string) {
    super(app);
  }

  finish(value: { targetDay: string; time?: string } | null) {
    if (!this.finished) {
      this.finished = true;
      this.resolveResult(value);
      this.close();
    }
  }

  onOpen() {
    this.modalEl.addClass("ticktick-bulk-input-modal");

    this.titleEl.setText(`زمان‌بندی ${this.count} تسک`);

    let targetDay = this.defaultDay;
    const dateWrapper = this.contentEl.createDiv({ cls: "ticktick-bulk-input-wrapper" });
    new JalaliDatePicker(dateWrapper, "تاریخ سررسید (شمسی):", this.defaultDay, val => targetDay = val);

    const timeWrapper = this.contentEl.createDiv({ cls: "ticktick-bulk-input-wrapper" });
    timeWrapper.createEl("label", { text: "ساعت (اختیاری):" });
    const timeInput = timeWrapper.createEl("input", {
      type: "time"
    });

    const buttonContainer = this.contentEl.createDiv({ cls: "modal-button-container" });
    
    const cancelBtn = buttonContainer.createEl("button", { text: "انصراف" });
    cancelBtn.addEventListener("click", () => this.finish(null));

    const applyBtn = buttonContainer.createEl("button", {
      text: "اعمال زمان‌بندی",
      cls: "mod-cta"
    });
    applyBtn.addEventListener("click", () => {
      if (!targetDay) return;
      this.finish({ targetDay, time: timeInput.value.trim() || undefined });
    });
  }

  onClose() {
    this.contentEl.empty();
    if (!this.finished) {
      this.finished = true;
      this.resolveResult(null);
    }
  }

  openAndWait() {
    this.open();
    return this.result;
  }
}
