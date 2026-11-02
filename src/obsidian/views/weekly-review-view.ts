import { ItemView, WorkspaceLeaf } from "obsidian";
import { WEEKLY_REVIEW_VIEW_TYPE } from "../constants";
import { WeeklyReview } from "../weekly-review";
import type TickTickBridgePlugin from "../main";

export class WeeklyReviewView extends ItemView {
  private review?: WeeklyReview;

  constructor(leaf: WorkspaceLeaf, private plugin: TickTickBridgePlugin) {
    super(leaf);
  }

  getViewType() { return WEEKLY_REVIEW_VIEW_TYPE; }
  getDisplayText() { return "مرور هفتگی و داشبورد اجرا"; }
  getIcon() { return "bar-chart-2"; }

  async onOpen() { await this.render(); }

  async render() {
    this.contentEl.addClass("ticktick-weekly-review-panel");
    this.review ??= new WeeklyReview(this.contentEl, this.plugin.weeklyReviewHost());
    await this.review.render();
  }

  async onClose() {
    this.review?.destroy();
    this.review = undefined;
  }
}
