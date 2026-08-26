import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";

const mockSelect = vi.fn();
const mockUpdate = vi.fn();

vi.mock("../../../apps/api/src/database", () => ({
  default: {
    select: (...args: unknown[]) => mockSelect(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
  },
}));

import {
  buildTaskCoverMap,
  clearAnotaCover,
  setAnotaCover,
} from "../../../apps/api/src/task/controllers/anota-vehicle-cover";

// A single mock chain shape covers every query/update this file issues:
// select(...).from(...).where(...).limit(1) or .orderBy(...), and
// update(...).set(...).where(...).returning(). Only one terminal method is
// ever called per real query, so resolving all three terminals to the same
// value is safe and keeps the mock small.
function makeChain(resolvedValue: unknown) {
  const chain: Record<string, Mock> = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    set: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(resolvedValue)),
    orderBy: vi.fn(() => Promise.resolve(resolvedValue)),
    returning: vi.fn(() => Promise.resolve(resolvedValue)),
  };
  return chain;
}

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

  // Phase 4 Plan 06 (D-16): the explicit-cover second argument.
  describe("with an explicit cover map (D-16)", () => {
    const rows = [
      { taskId: "task-1", id: "asset-old", createdAt: "2026-01-01T00:00:00Z" },
      { taskId: "task-1", id: "asset-new", createdAt: "2026-01-02T00:00:00Z" },
    ];

    it("honours an explicit cover that still belongs to the task", () => {
      const map = buildTaskCoverMap(rows, new Map([["task-1", "asset-new"]]));

      expect(map.get("task-1")).toBe("asset-new");
    });

    it("falls back to earliest when the explicit cover's asset is gone", () => {
      const map = buildTaskCoverMap(
        rows,
        new Map([["task-1", "asset-deleted"]]),
      );

      expect(map.get("task-1")).toBe("asset-old");
    });

    it("behaves exactly as before this change when the explicit cover is null", () => {
      const withNull = buildTaskCoverMap(rows, new Map([["task-1", null]]));
      const withNoArg = buildTaskCoverMap(rows);

      expect(withNull.get("task-1")).toBe("asset-old");
      expect(withNull.get("task-1")).toBe(withNoArg.get("task-1"));
    });

    it("never lets an id belonging to a different task select that task's asset", () => {
      const twoTaskRows = [
        ...rows,
        { taskId: "task-2", id: "asset-2a", createdAt: "2026-01-01T00:00:00Z" },
      ];

      // "asset-2a" belongs to task-2, but is set as task-1's explicit cover.
      const map = buildTaskCoverMap(
        twoTaskRows,
        new Map([["task-1", "asset-2a"]]),
      );

      expect(map.get("task-1")).toBe("asset-old");
      expect(map.get("task-2")).toBe("asset-2a");
    });

    it("resolves to null for a task with no assets at all, under every combination", () => {
      const withExplicit = buildTaskCoverMap(
        [],
        new Map([["task-1", "asset-x"]]),
      );
      const withNull = buildTaskCoverMap([], new Map([["task-1", null]]));
      const withNoArg = buildTaskCoverMap([]);

      expect(withExplicit.has("task-1")).toBe(false);
      expect(withNull.has("task-1")).toBe(false);
      expect(withNoArg.has("task-1")).toBe(false);
    });
  });
});

describe("setAnotaCover", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sets the cover when the asset belongs to the target task", async () => {
    mockSelect.mockReturnValueOnce(makeChain([{ id: "asset-1" }]));
    const updatedTask = { id: "task-1", coverAssetId: "asset-1" };
    mockUpdate.mockReturnValueOnce(makeChain([updatedTask]));

    const result = await setAnotaCover("task-1", "asset-1");

    expect(result).toEqual(updatedTask);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it("refuses an asset that does not belong to the target task", async () => {
    mockSelect.mockReturnValueOnce(makeChain([]));

    await expect(
      setAnotaCover("task-1", "asset-of-task-2"),
    ).rejects.toMatchObject({
      status: 400,
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("throws 404 when the task itself is gone by the time the update runs", async () => {
    mockSelect.mockReturnValueOnce(makeChain([{ id: "asset-1" }]));
    mockUpdate.mockReturnValueOnce(makeChain([]));

    await expect(setAnotaCover("task-1", "asset-1")).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe("clearAnotaCover", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes a null cover", async () => {
    const updatedTask = { id: "task-1", coverAssetId: null };
    mockUpdate.mockReturnValueOnce(makeChain([updatedTask]));

    const result = await clearAnotaCover("task-1");

    expect(result).toEqual(updatedTask);
  });

  it("throws 404 when the task doesn't exist", async () => {
    mockUpdate.mockReturnValueOnce(makeChain([]));

    await expect(clearAnotaCover("task-missing")).rejects.toMatchObject({
      status: 404,
    });
  });
});
