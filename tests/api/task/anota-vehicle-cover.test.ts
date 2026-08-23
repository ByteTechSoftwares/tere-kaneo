import { describe, expect, it } from "vitest";
import { buildTaskCoverMap } from "../../../apps/api/src/task/controllers/anota-vehicle-cover";

describe("buildTaskCoverMap", () => {
  it("picks the earliest row when a task has several image rows", () => {
    const map = buildTaskCoverMap([
      { taskId: "task-1", id: "asset-old", createdAt: "2026-01-01T00:00:00Z" },
      { taskId: "task-1", id: "asset-new", createdAt: "2026-01-02T00:00:00Z" },
    ]);

    expect(map.get("task-1")).toBe("asset-old");
  });

  it("never lets a later row displace an earlier one", () => {
    const map = buildTaskCoverMap([
      { taskId: "task-1", id: "asset-a", createdAt: "2026-01-01T00:00:00Z" },
      { taskId: "task-1", id: "asset-b", createdAt: "2026-01-02T00:00:00Z" },
      { taskId: "task-1", id: "asset-c", createdAt: "2026-01-03T00:00:00Z" },
    ]);

    expect(map.get("task-1")).toBe("asset-a");
    expect(map.size).toBe(1);
  });

  it("skips rows with a null taskId", () => {
    const map = buildTaskCoverMap([
      { taskId: null, id: "asset-orphan", createdAt: "2026-01-01T00:00:00Z" },
      { taskId: "task-1", id: "asset-a", createdAt: "2026-01-02T00:00:00Z" },
    ]);

    expect(map.has("task-1")).toBe(true);
    expect(map.get("task-1")).toBe("asset-a");
    expect(map.size).toBe(1);
  });

  it("returns an empty map for empty input", () => {
    const map = buildTaskCoverMap([]);

    expect(map.size).toBe(0);
  });

  it("gives several tasks each their own earliest row", () => {
    const map = buildTaskCoverMap([
      { taskId: "task-1", id: "asset-1a", createdAt: "2026-01-01T00:00:00Z" },
      { taskId: "task-2", id: "asset-2a", createdAt: "2026-01-01T00:00:00Z" },
      { taskId: "task-1", id: "asset-1b", createdAt: "2026-01-02T00:00:00Z" },
      { taskId: "task-2", id: "asset-2b", createdAt: "2026-01-02T00:00:00Z" },
    ]);

    expect(map.get("task-1")).toBe("asset-1a");
    expect(map.get("task-2")).toBe("asset-2a");
    expect(map.size).toBe(2);
  });
});
