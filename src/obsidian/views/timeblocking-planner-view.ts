import { ItemView, WorkspaceLeaf } from "obsidian";
import { TIMEBLOCK_PLANNER_VIEW_TYPE } from "../constants";
import { TimeblockingPlanner } from "../timeblocking-planner";
import type TickTickBridgePlugin from "../main";

export class TimeblockingPlannerView extends ItemView {
  private planner?: TimeblockingPlanner;

  constructor(leaf: WorkspaceLeaf, private plugin: TickTickBridgePlugin) {
    super(leaf);
  }

  getViewType() { return TIMEBLOCK_PLANNER_VIEW_TYPE; }
  getDisplayText() { return "برنامه‌ریز و بلوک‌بندی زمانی روزانه"; }
  getIcon() { return "clock"; }

  async onOpen() { await this.render(); }

  async render() {
    this.contentEl.addClass("ticktick-timeblock-view-container");
    this.planner ??= new TimeblockingPlanner(this.contentEl, this.plugin.timeblockingPlannerHost());
    await this.planner.render();
  }

  async onClose() {
    this.planner?.destroy();
    this.planner = undefined;
  }
}
