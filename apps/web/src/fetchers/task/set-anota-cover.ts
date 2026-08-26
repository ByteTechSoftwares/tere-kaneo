// Phase 4 Plan 06 (D-16): sets or clears the vehicle-card cover override
// via PUT /task/anota-cover/:taskId — an omitted assetId clears back to
// earliest-attached-wins, mirroring how the sibling due-date route treats
// an omitted body field.
import { client } from "@kaneo/libs";

async function setAnotaCover(taskId: string, assetId: string | null) {
  const response = await client.task["anota-cover"][":taskId"].$put({
    param: { taskId },
    json: assetId ? { assetId } : {},
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default setAnotaCover;
