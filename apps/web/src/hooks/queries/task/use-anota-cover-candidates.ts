// Phase 4 Plan 06 (D-16): lazy, popover-scoped read of a task's own image
// assets. `enabled` keeps this from firing on every board render — a
// column of N vehicle cards must not issue N requests just for the
// affordance to exist unopened.
import { useQuery } from "@tanstack/react-query";
import getAnotaCoverCandidates from "@/fetchers/task/get-anota-cover-candidates";

export function useAnotaCoverCandidates(taskId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["anota-cover-candidates", taskId],
    queryFn: () => getAnotaCoverCandidates(taskId),
    enabled,
  });
}
