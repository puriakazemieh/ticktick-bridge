import { ItemView, WorkspaceLeaf } from "obsidian";
import { PLANNER_VIEW_TYPE } from "../constants";
import { PlanningCalendar } from "../planning-calendar";
import { renderWorkspaceHeader } from "../components/workspace-header";
import type TickTickBridgePlugin from "../main";

export class PlanningView extends ItemView {
  private planner?: PlanningCalendar;
  private headerSlot?: HTMLElement;
  private bodySlot?: HTMLElement;

  constructor(leaf: WorkspaceLeaf, private plugin: TickTickBridgePlugin) {
    super(leaf);
  }

  getViewType() { return PLANNER_VIEW_TYPE; }
  getDisplayText() { return "تقویم برنامه‌ریزی TickTick"; }
  getIcon() { return "calendar-days"; }

  async onOpen() { await this.render(); }

  async render() {
    this.contentEl.addClass("ticktick-workspace-view-root");
    this.contentEl.addClass("ticktick-planner-panel");
    if (!this.headerSlot || !this.bodySlot) {
      this.contentEl.empty();
      this.headerSlot = this.contentEl.createDiv({ cls: "ticktick-workspace-header-slot" });
      this.bodySlot = this.contentEl.createDiv({ cls: "ticktick-workspace-body-slot" });
      renderWorkspaceHeader(this.headerSlot, {
        plugin: this.plugin,
        leaf: this.leaf,
        activeViewType: this.getViewType()
      });
      this.planner = new PlanningCalendar(this.bodySlot, this.plugin.plannerHost());
    }
    await this.planner?.render();
  }

  async onClose() {
    this.planner = undefined;
    this.headerSlot = undefined;
    this.bodySlot = undefined;
  }
}
