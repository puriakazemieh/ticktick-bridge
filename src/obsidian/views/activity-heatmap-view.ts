import { ItemView, WorkspaceLeaf } from "obsidian";
import { HEATMAP_VIEW_TYPE } from "../constants";
import { ActivityHeatmap } from "../activity-heatmap";
import type TickTickBridgePlugin from "../main";

export class ActivityHeatmapView extends ItemView {
  private heatmap?: ActivityHeatmap;

  constructor(leaf: WorkspaceLeaf, private plugin: TickTickBridgePlugin) {
    super(leaf);
  }

  getViewType() { return HEATMAP_VIEW_TYPE; }
  getDisplayText() { return "هیت‌مپ فعالیت و پیوستگی سالانه"; }
  getIcon() { return "flame"; }

  async onOpen() { await this.render(); }

  async render() {
    this.contentEl.addClass("ticktick-heatmap-view-container");
    this.heatmap ??= new ActivityHeatmap(this.contentEl, this.plugin.activityHeatmapHost());
    await this.heatmap.render();
  }

  async onClose() {
    this.heatmap?.destroy();
    this.heatmap = undefined;
  }
}
