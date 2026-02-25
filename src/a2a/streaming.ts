/**
 * A2A streaming and async runtime primitives (T101).
 *
 * Provides an in-memory event bus for task status/artifact updates and
 * push-notification config storage helpers.
 */

import type {
  PushNotificationConfig,
  TaskArtifactUpdateEvent,
  TaskStatusUpdateEvent,
} from "@a2a-js/sdk";

export type TaskStreamEvent = TaskStatusUpdateEvent | TaskArtifactUpdateEvent;

type StreamListener = (event: TaskStreamEvent) => void;

function resolveTaskId(event: TaskStreamEvent): string {
  const candidate = event as unknown as {
    taskId?: string;
    task?: { id?: string };
  };

  const taskId = candidate.taskId ?? candidate.task?.id;
  if (!taskId) {
    throw new Error("Task stream event is missing task identifier");
  }
  return taskId;
}

/**
 * In-memory event bus for task lifecycle streaming events.
 */
export class TaskEventBus {
  private history = new Map<string, TaskStreamEvent[]>();
  private listeners = new Map<string, Set<StreamListener>>();

  publishStatusUpdate(event: TaskStatusUpdateEvent): void {
    this.publish(event);
  }

  publishArtifactUpdate(event: TaskArtifactUpdateEvent): void {
    this.publish(event);
  }

  publish(event: TaskStreamEvent): void {
    const taskId = resolveTaskId(event);
    const events = this.history.get(taskId) ?? [];
    events.push(event);
    this.history.set(taskId, events);

    const listeners = this.listeners.get(taskId);
    if (listeners) {
      for (const listener of listeners) {
        listener(event);
      }
    }
  }

  subscribe(taskId: string, listener: StreamListener): () => void {
    let set = this.listeners.get(taskId);
    if (!set) {
      set = new Set();
      this.listeners.set(taskId, set);
    }
    set.add(listener);

    return () => {
      const active = this.listeners.get(taskId);
      if (!active) return;
      active.delete(listener);
      if (active.size === 0) {
        this.listeners.delete(taskId);
      }
    };
  }

  getHistory(taskId: string): TaskStreamEvent[] {
    return [...(this.history.get(taskId) ?? [])];
  }
}

export interface StreamIteratorOptions {
  timeoutMs?: number;
}

/**
 * Build an async iterator for real-time task stream events.
 */
export async function* streamTaskEvents(
  bus: TaskEventBus,
  taskId: string,
  options: StreamIteratorOptions = {},
): AsyncGenerator<TaskStreamEvent> {
  const queue: TaskStreamEvent[] = [];
  let wakeUp: (() => void) | null = null;

  const unsubscribe = bus.subscribe(taskId, (event) => {
    queue.push(event);
    if (wakeUp) {
      wakeUp();
      wakeUp = null;
    }
  });

  const timeoutMs = options.timeoutMs ?? 30_000;

  try {
    // Emit existing history first for catch-up behavior.
    for (const event of bus.getHistory(taskId)) {
      yield event;
    }

    while (true) {
      if (queue.length > 0) {
        const event = queue.shift();
        if (event) {
          yield event;
          continue;
        }
      }

      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          if (wakeUp === resolve) {
            wakeUp = null;
          }
          resolve();
        }, timeoutMs);

        wakeUp = () => {
          clearTimeout(timer);
          resolve();
        };
      });
    }
  } finally {
    unsubscribe();
  }
}

/**
 * In-memory manager for async push-notification configs.
 */
export class PushNotificationConfigStore {
  private configs = new Map<string, Map<string, PushNotificationConfig>>();

  set(taskId: string, configId: string, config: PushNotificationConfig): void {
    let taskConfigs = this.configs.get(taskId);
    if (!taskConfigs) {
      taskConfigs = new Map();
      this.configs.set(taskId, taskConfigs);
    }
    taskConfigs.set(configId, config);
  }

  get(taskId: string, configId: string): PushNotificationConfig | undefined {
    return this.configs.get(taskId)?.get(configId);
  }

  list(taskId: string): PushNotificationConfig[] {
    return [...(this.configs.get(taskId)?.values() ?? [])];
  }

  delete(taskId: string, configId: string): boolean {
    const taskConfigs = this.configs.get(taskId);
    if (!taskConfigs) {
      return false;
    }

    const removed = taskConfigs.delete(configId);
    if (taskConfigs.size === 0) {
      this.configs.delete(taskId);
    }
    return removed;
  }
}
