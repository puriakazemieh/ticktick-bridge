import { ItemView, WorkspaceLeaf } from "obsidian";
import { WEEKLY_REVIEW_VIEW_TYPE } from "../constants";
import { WeeklyReview } from "../weekly-review";
import { renderWorkspaceHeader } from "../components/workspace-header";
import type TickTickBridgePlugin from "../main";

export class WeeklyReviewView extends ItemView {
  private review?: WeeklyReview;
  private headerSlot?: HTMLElement;
  private bodySlot?: HTMLElement;

  constructor(leaf: WorkspaceLeaf, private plugin: TickTickBridgePlugin) {
    super(leaf);
  }

  getViewType() { return WEEKLY_REVIEW_VIEW_TYPE; }
  getDisplayText() { return "مرور هفتگی و داشبورد اجرا"; }
  getIcon() { return "check-check"; }

  async onOpen() { await this.render(); }

  async render() {
    this.contentEl.addClass("ticktick-workspace-view-root");
    this.contentEl.addClass("ticktick-weekly-review-panel");
    if (!this.headerSlot || !this.bodySlot) {
      this.contentEl.empty();
      this.headerSlot = this.contentEl.createDiv({ cls: "ticktick-workspace-header-slot" });
      this.bodySlot = this.contentEl.createDiv({ cls: "ticktick-workspace-body-slot" });
      renderWorkspaceHeader(this.headerSlot, {
        plugin: this.plugin,
        leaf: this.leaf,
        activeViewType: this.getViewType()
      });
      this.review = new WeeklyReview(this.bodySlot, this.plugin.weeklyReviewHost());
    }
    await this.review?.render();
  }

  async onClose() {
    this.review?.destroy();
    this.review = undefined;
    this.headerSlot = undefined;
    this.bodySlot = undefined;
  }
}
