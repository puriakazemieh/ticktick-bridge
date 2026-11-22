import { App, Modal, setIcon } from "obsidian";
import type { TickTickTask } from "../types";

export interface BulkConfirmOptions {
  title: string;
  description: string;
  confirmLabel: string;
  isDestructive?: boolean;
}

export class BulkConfirmModal extends Modal {
  private resolveResult!: (value: boolean) => void;
  private result = new Promise<boolean>(resolve => {
    this.resolveResult = resolve;
  });
  private finished = false;

  constructor(
    app: App,
    private tasks: TickTickTask[],
    private options: BulkConfirmOptions
  ) {
    super(app);
  }

  finish(value: boolean) {
    if (!this.finished) {
      this.finished = true;
      this.resolveResult(value);
      this.close();
    }
  }

  onOpen() {
    this.modalEl.addClass("ticktick-bulk-confirm-modal");

    this.titleEl.setText(this.options.title);

    const descEl = this.contentEl.createEl("p", {
      cls: "ticktick-bulk-desc",
      text: this.options.description
    });

    if (this.options.isDestructive) {
      const alertBox = this.contentEl.createDiv({ cls: "ticktick-bulk-alert" });
      const alertIcon = alertBox.createSpan({ cls: "mod-icon" });
      setIcon(alertIcon, "alert-triangle");
      alertBox.createSpan({
        text: `هشدار: این عملیات روی ${this.tasks.length} تسک غیرقابل‌بازگشت است.`
      });
    }

    // List of affected tasks (preview of exact count and sample titles)
    const previewContainer = this.contentEl.createDiv({ cls: "ticktick-bulk-preview-list" });
    const maxPreview = 6;
    const previewTasks = this.tasks.slice(0, maxPreview);

    for (const t of previewTasks) {
      const item = previewContainer.createDiv({ cls: "ticktick-bulk-preview-item" });
      const dot = item.createSpan({ cls: "ticktick-bulk-item-dot" });
      dot.setText("•");
      item.createSpan({ cls: "ticktick-bulk-item-title", text: t.title || "بدون عنوان" });
      if (t.projectName) {
        item.createSpan({ cls: "ticktick-bulk-item-proj", text: `(${t.projectName})` });
      }
    }

    if (this.tasks.length > maxPreview) {
      const remaining = this.tasks.length - maxPreview;
      previewContainer.createDiv({
        cls: "ticktick-bulk-more",
        text: `و ${remaining} تسک دیگر...`
      });
    }

    // Buttons
    const actions = this.contentEl.createDiv({ cls: "modal-button-container" });
    
    const cancelBtn = actions.createEl("button", { text: "انصراف" });
    cancelBtn.addEventListener("click", () => this.finish(false));

    const confirmBtn = actions.createEl("button", {
      text: this.options.confirmLabel,
      cls: this.options.isDestructive ? "mod-warning" : "mod-cta"
    });
    confirmBtn.addEventListener("click", () => this.finish(true));
  }

  onClose() {
    this.contentEl.empty();
    if (!this.finished) {
      this.finished = true;
      this.resolveResult(false);
    }
  }

  openAndWait(): Promise<boolean> {
    this.open();
    return this.result;
  }
}
