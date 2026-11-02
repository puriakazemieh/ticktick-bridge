import { ItemView, WorkspaceLeaf } from "obsidian";
import { EISENHOWER_MATRIX_VIEW_TYPE } from "../constants";
import { EisenhowerMatrix } from "../eisenhower-matrix";
import type TickTickBridgePlugin from "../main";

export class EisenhowerMatrixView extends ItemView {
  private matrix?: EisenhowerMatrix;

  constructor(leaf: WorkspaceLeaf, private plugin: TickTickBridgePlugin) {
    super(leaf);
  }

  getViewType() { return EISENHOWER_MATRIX_VIEW_TYPE; }
  getDisplayText() { return "ماتریس تصمیم‌گیری آیزنهاور"; }
  getIcon() { return "grid"; }

  async onOpen() { await this.render(); }

  async render() {
    this.contentEl.addClass("ticktick-matrix-view-container");
    this.matrix ??= new EisenhowerMatrix(this.contentEl, this.plugin.eisenhowerMatrixHost());
    await this.matrix.render();
  }

  async onClose() {
    this.matrix?.destroy();
    this.matrix = undefined;
  }
}
