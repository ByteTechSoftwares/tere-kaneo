// vehicle-cover.tsx
//
// Phase 3 Plan 02 (PHOTO-04, D-01/D-03/D-04): the vehicle-card cover
// thumbnail / NO PHOTO placeholder. Anota-namespaced fork code under
// D-25 — co-located with task-card.tsx (board-card-specific) rather
// than apps/web/src/anota/ (app-global surfaces like the chat panel).
//
// D-03: a missing vehicle photo must be SOCIALLY VISIBLE, not silently
// absent — the placeholder deliberately inverts the muted "?" assignee
// fallback with a loud amber warning treatment.
import { CameraOff } from "lucide-react";
import { useState } from "react";
import { getApiUrl } from "@/fetchers/get-api-url";

export const ANOTA_VEHICLE_BOARD_SLUG = "vehicles-ro";

type VehicleCoverProps = {
  coverAssetId: string | null | undefined;
};

const COVER_BAND_CLASS = "mb-2.5 h-28 w-full overflow-hidden rounded-md";

export function VehicleCover({ coverAssetId }: VehicleCoverProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const [trackedAssetId, setTrackedAssetId] = useState(coverAssetId);

  // Reset the failed flag during render (not an effect) whenever the cover
  // id itself changes, so a stale onError from a previous card's asset
  // never permanently sticks this card on the placeholder branch.
  if (coverAssetId !== trackedAssetId) {
    setTrackedAssetId(coverAssetId);
    setImageFailed(false);
  }

  if (coverAssetId && !imageFailed) {
    return (
      <div className={COVER_BAND_CLASS}>
        <img
          src={getApiUrl(`asset/${coverAssetId}`)}
          alt="Vehicle"
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={`${COVER_BAND_CLASS} flex items-center justify-center gap-1.5 border border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-400`}
    >
      <CameraOff className="h-4 w-4" />
      <span className="text-xs font-bold tracking-wide">NO PHOTO</span>
    </div>
  );
}
