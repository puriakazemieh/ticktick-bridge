import { ItemView, WorkspaceLeaf } from "obsidian";
import { TIMELINE_VIEW_TYPE } from "../constants";
import { ProjectTimeline } from "../project-timeline";
import type TickTickBridgePlugin from "../main";

export class ProjectTimelineView extends ItemView {
  private timeline?: ProjectTimeline;

  constructor(leaf: WorkspaceLeaf, private plugin: TickTickBridgePlugin) {
    super(leaf);
  }

  getViewType() { return TIMELINE_VIEW_TYPE; }
  getDisplayText() { return "تایم‌لاین و گانت پروژه‌های TickTick"; }
  getIcon() { return "calendar-range"; }

  async onOpen() { await this.render(); }

  async render() {
    this.contentEl.addClass("ticktick-timeline-panel");
    this.timeline ??= new ProjectTimeline(this.contentEl, this.plugin.timelineHost());
    await this.timeline.render();
  }
}
