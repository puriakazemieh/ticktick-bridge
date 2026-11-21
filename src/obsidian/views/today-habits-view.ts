import { ItemView, WorkspaceLeaf } from "obsidian";
import { HABIT_VIEW_TYPE } from "../constants";
import type TickTickBridgePlugin from "../main";

export class TodayHabitsView extends ItemView {
  constructor(leaf: WorkspaceLeaf, private plugin: TickTickBridgePlugin) {
    super(leaf);
  }

  getViewType() { return HABIT_VIEW_TYPE; }
  getDisplayText() { return "عادت‌های امروز"; }
  getIcon() { return "activity"; }

  async onOpen() { await this.render(); }

  async render() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("ticktick-today-habits-panel");
    contentEl.createEl("h2", { text: "عادت‌های امروز" });
    const toolbar = contentEl.createDiv({ cls: "ticktick-habits-view-toolbar" });
    const addHabitBtn = toolbar.createEl("button", { text: "+ عادت جدید", cls: "mod-cta" });
    addHabitBtn.addEventListener("click", () => {
      void this.plugin.openHabitEditor();
    });
    const refresh = toolbar.createEl("button", { text: "به‌روزرسانی" });
    refresh.addEventListener("click", async () => {
      refresh.disabled = true;
      try {
        await this.plugin.syncNow();
        await this.render();
      } finally {
        refresh.disabled = false;
      }
    });
    const panel = contentEl.createDiv({ cls: "ticktick-bridge-habit-panel" });
    await this.plugin.renderHabitBlock(panel, true);
  }
}
