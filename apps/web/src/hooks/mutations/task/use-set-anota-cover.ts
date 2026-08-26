// Phase 4 Plan 06 (D-16): mutation hook for the set/clear cover route.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import setAnotaCover from "@/fetchers/task/set-anota-cover";

export function useSetAnotaCover() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      assetId,
    }: {
      taskId: string;
      projectId: string;
      assetId: string | null;
    }) => setAnotaCover(taskId, assetId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["tasks", variables.projectId],
      });
      queryClient.invalidateQueries({
        queryKey: ["anota-cover-candidates", variables.taskId],
      });
    },
  });
}
