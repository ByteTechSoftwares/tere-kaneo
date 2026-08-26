// anota-vehicle-cover.ts
//
// Phase 3 Plan 02 (PHOTO-04, D-01/D-02/D-04): the vehicle-card cover-photo
// seam. Lives in its own Anota-namespaced file, not inlined into
// get-tasks.ts, so the upstream controller only takes a minimal
// documented mount point under the D-25 fork-discipline rule.
//
// Semantics (D-02, original): the FIRST photo attached to a vehicle card is
// its cover for the life of the vehicle — the earliest image wins, and no
// later attachment ever displaces it.
//
// Phase 4 Plan 06 (D-16, amends D-02, does not replace it): a manual,
// persisted override. taskTable.coverAssetId is nullable — null keeps the
// original D-02 earliest-wins behaviour exactly as it was; a non-null value
// wins ONLY when it still points at an asset actually attached to that same
// task (an id whose asset has since been removed, or that belongs to a
// different task, degrades straight back to earliest-wins rather than
// rendering a broken thumbnail or leaking another card's photo). This file
// also exposes the PUT /task/anota-cover/:taskId route (set/clear) and a
// GET beside it (list a task's cover candidates) as a small Hono sub-router
// — the only mount point task/index.ts takes is importing and registering
// that router.
import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { validator } from "hono-openapi";
import * as v from "valibot";
import { requireEntitlement } from "../../billing/require-entitlement-middleware";
import db from "../../database";
import { assetTable, taskTable } from "../../database/schema";
import { requireWorkspacePermission } from "../../utils/require-workspace-permission";
import { workspaceAccess } from "../../utils/workspace-access-middleware";

type CoverAssetRow = {
  taskId: string | null;
  id: string;
  createdAt: Date | string | null;
};

/**
 * Builds a taskId -> cover asset id map from asset rows already ordered
 * oldest-first (ascending createdAt). Rows with a null taskId are skipped.
 *
 * With no second argument, behaves exactly as the original D-02 function:
 * the earliest row for a task wins permanently.
 *
 * With `explicitCovers` (D-16, a taskId -> stored coverAssetId map), a
 * non-null explicit cover wins ONLY when it names an asset that is still
 * among that same task's own rows — otherwise (removed asset, or an id
 * belonging to a different task) the task falls back to its earliest row,
 * same as if no explicit cover had ever been set.
 */
export function buildTaskCoverMap(
  rows: CoverAssetRow[],
  explicitCovers?: Map<string, string | null>,
): Map<string, string> {
  const earliestByTask = new Map<string, string>();
  const assetIdsByTask = new Map<string, Set<string>>();

  for (const row of rows) {
    if (!row.taskId) {
      continue;
    }
    if (!earliestByTask.has(row.taskId)) {
      earliestByTask.set(row.taskId, row.id);
    }
    let assetIds = assetIdsByTask.get(row.taskId);
    if (!assetIds) {
      assetIds = new Set<string>();
      assetIdsByTask.set(row.taskId, assetIds);
    }
    assetIds.add(row.id);
  }

  if (!explicitCovers) {
    return earliestByTask;
  }

  const coverMap = new Map<string, string>();
  for (const [taskId, earliestAssetId] of earliestByTask) {
    const explicitAssetId = explicitCovers.get(taskId);
    const explicitStillAttached =
      explicitAssetId != null &&
      (assetIdsByTask.get(taskId)?.has(explicitAssetId) ?? false);
    coverMap.set(
      taskId,
      explicitStillAttached ? explicitAssetId : earliestAssetId,
    );
  }

  return coverMap;
}

/**
 * Sets the explicit cover override. Rejects with 400 when the asset does
 * not exist, is not an image, or is not attached to this exact task — this
 * is the boundary that stops one task's id from ever selecting another
 * task's asset (T-04-32).
 */
export async function setAnotaCover(taskId: string, assetId: string) {
  const [asset] = await db
    .select({ id: assetTable.id })
    .from(assetTable)
    .where(
      and(
        eq(assetTable.id, assetId),
        eq(assetTable.taskId, taskId),
        eq(assetTable.kind, "image"),
      ),
    )
    .limit(1);

  if (!asset) {
    throw new HTTPException(400, {
      message: "That photo isn't attached to this task",
    });
  }

  const [updatedTask] = await db
    .update(taskTable)
    .set({ coverAssetId: assetId })
    .where(eq(taskTable.id, taskId))
    .returning();

  if (!updatedTask) {
    throw new HTTPException(404, { message: "Task not found" });
  }

  return updatedTask;
}

/** Clears the explicit cover override, returning the task to earliest-wins. */
export async function clearAnotaCover(taskId: string) {
  const [updatedTask] = await db
    .update(taskTable)
    .set({ coverAssetId: null })
    .where(eq(taskTable.id, taskId))
    .returning();

  if (!updatedTask) {
    throw new HTTPException(404, { message: "Task not found" });
  }

  return updatedTask;
}

/**
 * Lists a task's own attached images (oldest-first) plus which one is
 * currently the effective cover — the read side the dashboard's picker
 * affordance needs, since board summaries only carry the resolved
 * `coverAssetId`, never the full candidate list.
 */
export async function listAnotaCoverCandidates(taskId: string) {
  const [task] = await db
    .select({ id: taskTable.id, coverAssetId: taskTable.coverAssetId })
    .from(taskTable)
    .where(eq(taskTable.id, taskId))
    .limit(1);

  if (!task) {
    throw new HTTPException(404, { message: "Task not found" });
  }

  const images = await db
    .select({ id: assetTable.id, createdAt: assetTable.createdAt })
    .from(assetTable)
    .where(and(eq(assetTable.taskId, taskId), eq(assetTable.kind, "image")))
    .orderBy(asc(assetTable.createdAt));

  const coverMap = buildTaskCoverMap(
    images.map((image) => ({
      taskId,
      id: image.id,
      createdAt: image.createdAt,
    })),
    new Map([[taskId, task.coverAssetId]]),
  );

  return {
    coverAssetId: coverMap.get(taskId) ?? null,
    images,
  };
}

// Sub-router mounted by task/index.ts at "/anota-cover" — the file's only
// upstream mount point stays an import plus one `.route()` call (D-25).
export const anotaCoverRoutes = new Hono<{
  Variables: {
    userId: string;
  };
}>()
  .get(
    "/:taskId",
    validator("param", v.object({ taskId: v.string() })),
    workspaceAccess.fromTaskId(),
    async (c) => {
      const { taskId } = c.req.valid("param");
      const result = await listAnotaCoverCandidates(taskId);

      return c.json(result);
    },
  )
  .put(
    "/:taskId",
    validator("param", v.object({ taskId: v.string() })),
    validator("json", v.object({ assetId: v.optional(v.string()) })),
    workspaceAccess.fromTaskId(),
    requireWorkspacePermission({ task: ["update"] }),
    requireEntitlement,
    async (c) => {
      const { taskId } = c.req.valid("param");
      const { assetId } = c.req.valid("json");

      const task = assetId
        ? await setAnotaCover(taskId, assetId)
        : await clearAnotaCover(taskId);

      return c.json(task);
    },
  );
