import { Menu, setIcon, Notice } from "obsidian";
import { bulkSelectionStore } from "./selection-store";
import { BulkConfirmModal } from "./modals/bulk-confirm-modal";
import { BulkTagModal, BulkDateModal } from "./modals/bulk-input-modal";
import { todayInZone } from "../core/date.js";
import type { TickTickTask, TickTickProject } from "./types";

export interface BulkActionBarHost {
  app: any;
  timeZone: string;
  tasks: () => TickTickTask[];
  projects: () => Promise<TickTickProject[]> | TickTickProject[];
  executeBulkOperation: (taskIds: string[], operationType: string, params: any) => Promise<any>;
  onChanged: () => Promise<void>;
}

export class BulkActionBar {
  private container: HTMLElement;
  private unsubscribe: (() => void) | null = null;
  private isExecuting = false;

  constructor(private parent: HTMLElement, private host: BulkActionBarHost) {
    this.container = this.parent.createDiv({ cls: "ticktick-bulk-action-bar" });
    this.container.style.display = "none";
    this.container.style.direction = "rtl";

    this.unsubscribe = bulkSelectionStore.subscribe(() => {
      this.render();
    });
  }

  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.container.remove();
  }

  async render() {
    const selectedIds = bulkSelectionStore.getSelection();
    if (selectedIds.length === 0 || this.isExecuting) {
      this.container.style.display = "none";
      this.container.empty();
      return;
    }

    this.container.style.display = "flex";
    this.container.empty();

    const allTasks = this.host.tasks();
    const taskMap = new Map(allTasks.map(t => [String(t.id), t]));
    const selectedTasks = selectedIds.map(id => taskMap.get(id)).filter(Boolean) as TickTickTask[];

    // Counter Badge
    const countBadge = this.container.createDiv({ cls: "ticktick-bulk-counter" });
    const countIcon = countBadge.createSpan({ cls: "mod-icon" });
    setIcon(countIcon, "check-circle");
    countBadge.createSpan({ text: `${selectedTasks.length} تسک انتخاب‌شده` });

    // Actions Group
    const actionsGroup = this.container.createDiv({ cls: "ticktick-bulk-buttons" });

    // 1. Move to Project
    const projBtn = actionsGroup.createEl("button", {
      cls: "ticktick-bulk-btn",
      attr: { "aria-label": "تغییر پروژه" }
    });
    setIcon(projBtn.createSpan({ cls: "mod-icon" }), "folder");
    projBtn.createSpan({ text: "پروژه" });
    projBtn.addEventListener("click", async (e) => {
      const rawProjs = await this.host.projects();
      const projects = Array.isArray(rawProjs) ? rawProjs : [];
      const menu = new Menu();
      menu.addItem(i => i.setTitle("صندوق ورودی (Inbox)").onClick(() => void this.runOperation(selectedTasks, "project", { projectId: "inbox" })));
      for (const p of projects.filter(p => p.id !== "inbox")) {
        menu.addItem(i => i.setTitle(p.name).onClick(() => void this.runOperation(selectedTasks, "project", { projectId: String(p.id) })));
      }
      menu.showAtMouseEvent(e);
    });

    // 2. Tag Management
    const tagBtn = actionsGroup.createEl("button", {
      cls: "ticktick-bulk-btn",
      attr: { "aria-label": "مدیریت برچسب‌ها" }
    });
    setIcon(tagBtn.createSpan({ cls: "mod-icon" }), "tag");
    tagBtn.createSpan({ text: "برچسب" });
    tagBtn.addEventListener("click", async () => {
      const res = await new BulkTagModal(this.host.app, selectedTasks.length).openAndWait();
      if (!res) return;
      await this.runOperation(selectedTasks, res.action === "add" ? "tag-add" : "tag-remove", { tag: res.tag });
    });

    // 3. Priority
    const priorityBtn = actionsGroup.createEl("button", {
      cls: "ticktick-bulk-btn",
      attr: { "aria-label": "تنظیم اولویت" }
    });
    setIcon(priorityBtn.createSpan({ cls: "mod-icon" }), "flag");
    priorityBtn.createSpan({ text: "اولویت" });
    priorityBtn.addEventListener("click", (e) => {
      const menu = new Menu();
      menu.addItem(i => i.setTitle("🔴 اولویت بالا (High)").onClick(() => void this.runOperation(selectedTasks, "priority", { priority: 5 })));
      menu.addItem(i => i.setTitle("🟡 اولویت متوسط (Medium)").onClick(() => void this.runOperation(selectedTasks, "priority", { priority: 3 })));
      menu.addItem(i => i.setTitle("🔵 اولویت کم (Low)").onClick(() => void this.runOperation(selectedTasks, "priority", { priority: 1 })));
      menu.addItem(i => i.setTitle("⚪ بدون اولویت (None)").onClick(() => void this.runOperation(selectedTasks, "priority", { priority: 0 })));
      menu.showAtMouseEvent(e);
    });

    // 4. Schedule Date
    const dateBtn = actionsGroup.createEl("button", {
      cls: "ticktick-bulk-btn",
      attr: { "aria-label": "زمان‌بندی / تغییر تاریخ" }
    });
    setIcon(dateBtn.createSpan({ cls: "mod-icon" }), "calendar");
    dateBtn.createSpan({ text: "تاریخ" });
    dateBtn.addEventListener("click", async () => {
      const today = todayInZone(this.host.timeZone);
      const res = await new BulkDateModal(this.host.app, selectedTasks.length, today).openAndWait();
      if (!res) return;
      await this.runOperation(selectedTasks, "schedule-date", res);
    });

    // 5. Clear Date (Unschedule - requires confirmation)
    const clearDateBtn = actionsGroup.createEl("button", {
      cls: "ticktick-bulk-btn",
      attr: { "aria-label": "حذف تاریخ و لغو زمان‌بندی" }
    });
    setIcon(clearDateBtn.createSpan({ cls: "mod-icon" }), "calendar-x");
    clearDateBtn.createSpan({ text: "لغو تاریخ" });
    clearDateBtn.addEventListener("click", async () => {
      const confirmed = await new BulkConfirmModal(this.host.app, selectedTasks, {
        title: "لغو زمان‌بندی تسک‌ها",
        description: `آیا مطمئن هستید که می‌خواهید تاریخ سررسید ${selectedTasks.length} تسک را پاک کرده و آن‌ها را به بک‌لاگ منتقل کنید؟`,
        confirmLabel: "حذف تاریخ‌ها",
        isDestructive: false
      }).openAndWait();

      if (confirmed) {
        await this.runOperation(selectedTasks, "clear-date", {});
      }
    });

    // 6. Complete / Reopen
    const statusBtn = actionsGroup.createEl("button", {
      cls: "ticktick-bulk-btn",
      attr: { "aria-label": "تکمیل یا بازگشایی" }
    });
    setIcon(statusBtn.createSpan({ cls: "mod-icon" }), "check-square");
    statusBtn.createSpan({ text: "وضعیت" });
    statusBtn.addEventListener("click", (e) => {
      const menu = new Menu();
      menu.addItem(i => i.setTitle("✅ تکمیل تسک‌های انتخاب‌شده").onClick(() => void this.runOperation(selectedTasks, "complete", {})));
      menu.addItem(i => i.setTitle("🔄 بازگشایی مجدد تسک‌ها").onClick(() => void this.runOperation(selectedTasks, "reopen", {})));
      menu.showAtMouseEvent(e);
    });

    // 7. Delete (Destructive - requires preview confirmation)
    const deleteBtn = actionsGroup.createEl("button", {
      cls: "ticktick-bulk-btn mod-destructive",
      attr: { "aria-label": "حذف دائمی تسک‌ها" }
    });
    setIcon(deleteBtn.createSpan({ cls: "mod-icon" }), "trash-2");
    deleteBtn.createSpan({ text: "حذف" });
    deleteBtn.addEventListener("click", async () => {
      const confirmed = await new BulkConfirmModal(this.host.app, selectedTasks, {
        title: "حذف گروهی تسک‌ها",
        description: `آیا مطمئن هستید که می‌خواهید ${selectedTasks.length} تسک زیر را به صورت کامل از TickTick حذف کنید؟`,
        confirmLabel: "حذف دائمی",
        isDestructive: true
      }).openAndWait();

      if (confirmed) {
        await this.runOperation(selectedTasks, "delete", {});
      }
    });

    // 8. Clear Selection
    const clearBtn = this.container.createEl("button", {
      cls: "ticktick-bulk-close mod-icon",
      attr: { "aria-label": "لغو انتخاب‌ها (Escape)" }
    });
    setIcon(clearBtn, "x");
    clearBtn.addEventListener("click", () => {
      bulkSelectionStore.clear();
    });
  }

  private async runOperation(tasks: TickTickTask[], operationType: string, params: any) {
    if (this.isExecuting || tasks.length === 0) return;
    this.isExecuting = true;
    this.container.addClass("is-executing");

    new Notice(`در حال اعمال عملیات گروهی روی ${tasks.length} تسک...`);

    try {
      const taskIds = tasks.map(t => String(t.id));
      await this.host.executeBulkOperation(taskIds, operationType, params);
      bulkSelectionStore.clear();
      await this.host.onChanged();
    } catch (err) {
      new Notice(`خطا در اجرای عملیات گروهی: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      this.isExecuting = false;
      this.container.removeClass("is-executing");
      await this.render();
    }
  }
}
