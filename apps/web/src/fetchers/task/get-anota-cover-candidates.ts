// Phase 4 Plan 06 (D-16): fetches a task's own attached images plus which
// one is currently the effective cover — the read side of the dashboard's
// set-as-cover picker, backed by GET /task/anota-cover/:taskId.
import { client } from "@kaneo/libs";

async function getAnotaCoverCandidates(taskId: string) {
  const response = await client.task["anota-cover"][":taskId"].$get({
    param: { taskId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default getAnotaCoverCandidates;
