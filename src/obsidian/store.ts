/**
 * TickTick Bridge — Lightweight Centralized Event Bus & State Store
 * Enables reactive partial updates across open views without full-tree re-renders.
 */

import type { TickTickTask, TickTickHabit } from "../types/ticktick";

export type BridgeEventMap = {
  "task:created": { task: TickTickTask };
  "task:updated": { task: Partial<TickTickTask> & { id: string } };
  "task:completed": { taskId: string; task?: TickTickTask };
  "task:deleted": { taskId: string };
  "task:moved": { taskId: string; columnId: string };
  "habit:checkin": { habitId: string; day: string; value: number; goal: number; status: number };
  "sync:start": void;
  "sync:complete": { timestamp: string };
  "state:changed": void;
};

export type BridgeEventListener<T> = (data: T) => void | Promise<void>;

export class BridgeEventBus {
  private listeners = new Map<string, Set<Function>>();

  on<K extends keyof BridgeEventMap>(event: K, listener: BridgeEventListener<BridgeEventMap[K]>): () => void {
    let handlers = this.listeners.get(event);
    if (!handlers) {
      handlers = new Set();
      this.listeners.set(event, handlers);
    }
    handlers.add(listener);
    return () => this.off(event, listener);
  }

  off<K extends keyof BridgeEventMap>(event: K, listener: BridgeEventListener<BridgeEventMap[K]>): void {
    this.listeners.get(event)?.delete(listener);
  }

  emit<K extends keyof BridgeEventMap>(event: K, data: BridgeEventMap[K]): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          (handler as BridgeEventListener<BridgeEventMap[K]>)(data);
        } catch (err) {
          console.error(`[TickTickBridge] Error in event listener for "${event}":`, err);
        }
      }
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}

export const bridgeEvents = new BridgeEventBus();
