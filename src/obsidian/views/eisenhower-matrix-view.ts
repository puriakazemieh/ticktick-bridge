import { ItemView, WorkspaceLeaf } from "obsidian";
import { EISENHOWER_MATRIX_VIEW_TYPE } from "../constants";
import { EisenhowerMatrix } from "../eisenhower-matrix";
import { renderWorkspaceHeader } from "../components/workspace-header";
import type TickTickBridgePlugin from "../main";

export class EisenhowerMatrixView extends ItemView {
  private matrix?: EisenhowerMatrix;
  private headerSlot?: HTMLElement;
  private bodySlot?: HTMLElement;

  constructor(leaf: WorkspaceLeaf, private plugin: TickTickBridgePlugin) {
    super(leaf);
  }

  getViewType() { return EISENHOWER_MATRIX_VIEW_TYPE; }
  getDisplayText() { return "ماتریس تصمیم‌گیری آیزنهاور"; }
  getIcon() { return "grid"; }

  async onOpen() { await this.render(); }

  async render() {
    this.contentEl.addClass("ticktick-workspace-view-root");
    this.contentEl.addClass("ticktick-matrix-view-container");
    if (!this.headerSlot || !this.bodySlot) {
      this.contentEl.empty();
      this.headerSlot = this.contentEl.createDiv({ cls: "ticktick-workspace-header-slot" });
      this.bodySlot = this.contentEl.createDiv({ cls: "ticktick-workspace-body-slot" });
      renderWorkspaceHeader(this.headerSlot, {
        plugin: this.plugin,
        leaf: this.leaf,
        activeViewType: this.getViewType()
      });
      this.matrix = new EisenhowerMatrix(this.bodySlot, this.plugin.eisenhowerMatrixHost());
    }
    await this.matrix?.render();
  }

  async onClose() {
    this.matrix?.destroy();
    this.matrix = undefined;
    this.headerSlot = undefined;
    this.bodySlot = undefined;
  }
}
