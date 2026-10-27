import { ItemView, WorkspaceLeaf } from "obsidian";
import { PLANNER_VIEW_TYPE } from "../constants";
import { PlanningCalendar } from "../planning-calendar";
import type TickTickBridgePlugin from "../main";

export class PlanningView extends ItemView {
  private planner?: PlanningCalendar;

  constructor(leaf: WorkspaceLeaf, private plugin: TickTickBridgePlugin) {
    super(leaf);
  }

  getViewType() { return PLANNER_VIEW_TYPE; }
  getDisplayText() { return "تقویم برنامه‌ریزی TickTick"; }
  getIcon() { return "calendar-days"; }

  async onOpen() { await this.render(); }

  async render() {
    this.contentEl.addClass("ticktick-planner-panel");
    // Keep navigation mode/date/filter state across local cache updates and
    // scheduled syncs. Recreating this object forced month view back to week.
    this.planner ??= new PlanningCalendar(this.contentEl, this.plugin.plannerHost());
    await this.planner.render();
  }
}
