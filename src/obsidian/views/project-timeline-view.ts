import { ItemView, WorkspaceLeaf } from "obsidian";
import { TIMELINE_VIEW_TYPE } from "../constants";
import { ProjectTimeline } from "../project-timeline";
import { renderWorkspaceHeader } from "../components/workspace-header";
import type TickTickBridgePlugin from "../main";

export class ProjectTimelineView extends ItemView {
  private timeline?: ProjectTimeline;
  private headerSlot?: HTMLElement;
  private bodySlot?: HTMLElement;

  constructor(leaf: WorkspaceLeaf, private plugin: TickTickBridgePlugin) {
    super(leaf);
  }

  getViewType() { return TIMELINE_VIEW_TYPE; }
  getDisplayText() { return "تایم‌لاین و گانت پروژه‌های TickTick"; }
  getIcon() { return "calendar-range"; }

  async onOpen() { await this.render(); }

  async render() {
    this.contentEl.addClass("ticktick-workspace-view-root");
    this.contentEl.addClass("ticktick-timeline-panel");
    if (!this.headerSlot || !this.bodySlot) {
      this.contentEl.empty();
      this.headerSlot = this.contentEl.createDiv({ cls: "ticktick-workspace-header-slot" });
      this.bodySlot = this.contentEl.createDiv({ cls: "ticktick-workspace-body-slot" });
      renderWorkspaceHeader(this.headerSlot, {
        plugin: this.plugin,
        leaf: this.leaf,
        activeViewType: this.getViewType()
      });
      this.timeline = new ProjectTimeline(this.bodySlot, this.plugin.timelineHost());
    }
    await this.timeline?.render();
  }

  async onClose() {
    this.timeline = undefined;
    this.headerSlot = undefined;
    this.bodySlot = undefined;
  }
}
