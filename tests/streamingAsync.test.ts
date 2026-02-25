import { describe, expect, it } from "vitest";
import {
  PushNotificationConfigStore,
  TaskEventBus,
  streamTaskEvents,
} from "../src/index.js";

describe("A2A streaming runtime (T101)", () => {
  it("publishes and records status/artifact events", () => {
    const bus = new TaskEventBus();

    const statusEvent = {
      taskId: "task_1",
      status: { state: "working" },
    } as unknown;

    const artifactEvent = {
      taskId: "task_1",
      artifact: { artifactId: "art_1" },
    } as unknown;

    bus.publishStatusUpdate(statusEvent as never);
    bus.publishArtifactUpdate(artifactEvent as never);

    const history = bus.getHistory("task_1");
    expect(history).toHaveLength(2);
  });

  it("streams events through async iterator", async () => {
    const bus = new TaskEventBus();
    const iterator = streamTaskEvents(bus, "task_2", { timeoutMs: 50 });

    const pending = iterator.next();
    bus.publishStatusUpdate({ taskId: "task_2", status: { state: "working" } } as never);

    const first = await pending;
    expect(first.done).toBe(false);
    expect((first.value as { taskId?: string }).taskId).toBe("task_2");

    await iterator.return(undefined);
  });
});

describe("A2A push notification config store", () => {
  it("supports set/get/list/delete", () => {
    const store = new PushNotificationConfigStore();

    const config = {
      url: "https://example.com/webhook",
      token: "secret",
    } as unknown;

    store.set("task_1", "cfg_1", config as never);
    expect(store.get("task_1", "cfg_1")).toBeDefined();
    expect(store.list("task_1")).toHaveLength(1);
    expect(store.delete("task_1", "cfg_1")).toBe(true);
    expect(store.list("task_1")).toHaveLength(0);
  });
});
