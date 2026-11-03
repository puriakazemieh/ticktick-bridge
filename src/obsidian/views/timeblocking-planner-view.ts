import { ItemView, WorkspaceLeaf } from "obsidian";
import { TIMEBLOCK_PLANNER_VIEW_TYPE } from "../constants";
import { TimeblockingPlanner } from "../timeblocking-planner";
import { renderWorkspaceHeader } from "../components/workspace-header";
import type TickTickBridgePlugin from "../main";

export class TimeblockingPlannerView extends ItemView {
  private planner?: TimeblockingPlanner;
  private headerSlot?: HTMLElement;
  private bodySlot?: HTMLElement;

  constructor(leaf: WorkspaceLeaf, private plugin: TickTickBridgePlugin) {
    super(leaf);
  }

  getViewType() { return TIMEBLOCK_PLANNER_VIEW_TYPE; }
  getDisplayText() { return "برنامه‌ریز و بلوک‌بندی زمانی روزانه"; }
  getIcon() { return "clock"; }

  async onOpen() { await this.render(); }

  async render() {
    this.contentEl.addClass("ticktick-workspace-view-root");
    this.contentEl.addClass("ticktick-timeblock-view-container");
    if (!this.headerSlot || !this.bodySlot) {
      this.contentEl.empty();
      this.headerSlot = this.contentEl.createDiv({ cls: "ticktick-workspace-header-slot" });
      this.bodySlot = this.contentEl.createDiv({ cls: "ticktick-workspace-body-slot" });
      renderWorkspaceHeader(this.headerSlot, {
        plugin: this.plugin,
        leaf: this.leaf,
        activeViewType: this.getViewType()
      });
      this.planner = new TimeblockingPlanner(this.bodySlot, this.plugin.timeblockingPlannerHost());
    }
    await this.planner?.render();
  }

  async onClose() {
    this.planner?.destroy();
    this.planner = undefined;
    this.headerSlot = undefined;
    this.bodySlot = undefined;
  }
}
