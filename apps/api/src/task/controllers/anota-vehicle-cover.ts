// anota-vehicle-cover.ts
//
// Phase 3 Plan 02 (PHOTO-04, D-01/D-02/D-04): the vehicle-card cover-photo
// seam. Lives in its own Anota-namespaced file, not inlined into
// get-tasks.ts, so the upstream controller only takes a minimal
// documented mount point under the D-25 fork-discipline rule.
//
// Semantics (D-02): the FIRST photo attached to a vehicle card is its
// cover for the life of the vehicle — the earliest image wins, and no
// later attachment ever displaces it.
type CoverAssetRow = {
  taskId: string | null;
  id: string;
  createdAt: Date | string | null;
};

/**
 * Builds a taskId -> cover asset id map from asset rows already ordered
 * oldest-first (ascending createdAt). Rows with a null taskId are
 * skipped. Once a taskId has an entry, later rows for that same taskId
 * are ignored — the earliest row wins permanently.
 */
export function buildTaskCoverMap(rows: CoverAssetRow[]): Map<string, string> {
  const coverMap = new Map<string, string>();

  for (const row of rows) {
    if (!row.taskId) {
      continue;
    }
    if (!coverMap.has(row.taskId)) {
      coverMap.set(row.taskId, row.id);
    }
  }

  return coverMap;
}
