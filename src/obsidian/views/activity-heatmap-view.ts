import { ItemView, WorkspaceLeaf } from "obsidian";
import { HEATMAP_VIEW_TYPE } from "../constants";
import { ActivityHeatmap } from "../activity-heatmap";
import { renderWorkspaceHeader } from "../components/workspace-header";
import type TickTickBridgePlugin from "../main";

export class ActivityHeatmapView extends ItemView {
  private heatmap?: ActivityHeatmap;
  private headerSlot?: HTMLElement;
  private bodySlot?: HTMLElement;

  constructor(leaf: WorkspaceLeaf, private plugin: TickTickBridgePlugin) {
    super(leaf);
  }

  getViewType() { return HEATMAP_VIEW_TYPE; }
  getDisplayText() { return "هیت‌مپ فعالیت و پیوستگی سالانه"; }
  getIcon() { return "flame"; }

  async onOpen() { await this.render(); }

  async render() {
    this.contentEl.addClass("ticktick-workspace-view-root");
    this.contentEl.addClass("ticktick-heatmap-view-container");
    if (!this.headerSlot || !this.bodySlot) {
      this.contentEl.empty();
      this.headerSlot = this.contentEl.createDiv({ cls: "ticktick-workspace-header-slot" });
      this.bodySlot = this.contentEl.createDiv({ cls: "ticktick-workspace-body-slot" });
      renderWorkspaceHeader(this.headerSlot, {
        plugin: this.plugin,
        leaf: this.leaf,
        activeViewType: this.getViewType()
      });
      this.heatmap = new ActivityHeatmap(this.bodySlot, this.plugin.activityHeatmapHost());
    }
    await this.heatmap?.render();
  }

  async onClose() {
    this.heatmap?.destroy();
    this.heatmap = undefined;
    this.headerSlot = undefined;
    this.bodySlot = undefined;
  }
}
