import { App, Modal, Notice, Setting } from "obsidian";
import type { TickTickProject } from "../types";

export interface CreateTagModalOptions {
  projects: TickTickProject[];
  onCreate: (data: { tag: string; taskTitle?: string; projectId?: string }) => Promise<void>;
}

export class CreateTagModal extends Modal {
  private tag = "";
  private taskTitle = "";
  private projectId = "";

  constructor(app: App, private options: CreateTagModalOptions) {
    super(app);
    if (this.options.projects.length > 0) {
      const inbox = this.options.projects.find(p => p.isInbox || p.name === "Inbox" || p.name === "ورودی");
      this.projectId = String(inbox?.id ?? this.options.projects[0].id);
    }
  }

  onOpen() {
    this.modalEl.addClass("ticktick-create-tag-modal");
    this.modalEl.style.direction = "rtl";

    this.titleEl.setText("🏷️ ساخت برچسب جدید");

    this.contentEl.createEl("p", {
      cls: "ticktick-modal-desc",
      text: "نام برچسب جدید را وارد کنید. برای ثبت برچسب در TickTick، تسک اولیه با این برچسب ایجاد می‌شود."
    });

    // Tag name input
    new Setting(this.contentEl)
      .setName("نام برچسب")
      .setDesc("بدون کاراکتر # وارد کنید.")
      .addText(text => {
        text.setPlaceholder("مثال: فوری، کاری، مطالعه...")
          .setValue(this.tag)
          .onChange(val => {
            this.tag = val.trim().replace(/^[#＃]/, "");
          });
        text.inputEl.dir = "rtl";
        setTimeout(() => text.inputEl.focus(), 50);
        text.inputEl.addEventListener("keydown", e => {
          if (e.key === "Enter") {
            e.preventDefault();
            void this.submit();
          }
        });
      });

    // Optional task title input
    new Setting(this.contentEl)
      .setName("عنوان تسک اولیه (اختیاری)")
      .setDesc("در صورت خالی بودن، تسکی با نام خود برچسب ثبت می‌شود.")
      .addText(text => {
        text.setPlaceholder("مثال: تسک با برچسب جدید")
          .setValue(this.taskTitle)
          .onChange(val => {
            this.taskTitle = val;
          });
        text.inputEl.dir = "rtl";
        text.inputEl.addEventListener("keydown", e => {
          if (e.key === "Enter") {
            e.preventDefault();
            void this.submit();
          }
        });
      });

    // Project selection
    if (this.options.projects.length > 0) {
      new Setting(this.contentEl)
        .setName("پروژه / لیست مقصد")
        .setDesc("تسک اولیه در کدام لیست ایجاد شود.")
        .addDropdown(dd => {
          for (const p of this.options.projects) {
            dd.addOption(String(p.id), p.name);
          }
          dd.setValue(this.projectId);
          dd.onChange(val => {
            this.projectId = val;
          });
        });
    }

    const buttonContainer = this.contentEl.createDiv({ cls: "modal-button-container" });
    const cancelBtn = buttonContainer.createEl("button", { text: "انصراف" });
    cancelBtn.addEventListener("click", () => this.close());

    const saveBtn = buttonContainer.createEl("button", {
      text: "ساخت برچسب",
      cls: "mod-cta"
    });
    saveBtn.addEventListener("click", () => void this.submit());
  }

  private async submit() {
    const cleanTag = this.tag.trim().replace(/^[#＃]/, "");
    if (!cleanTag) {
      new Notice("لطفاً نام برچسب را وارد کنید.");
      return;
    }
    const finalTitle = this.taskTitle.trim() || `تسک #${cleanTag}`;
    try {
      await this.options.onCreate({
        tag: cleanTag,
        taskTitle: finalTitle,
        projectId: this.projectId
      });
      this.close();
    } catch (err) {
      new Notice(err instanceof Error ? err.message : "ایجاد برچسب ناموفق بود.");
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}
