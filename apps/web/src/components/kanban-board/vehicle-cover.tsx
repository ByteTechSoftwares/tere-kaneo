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
//
// Phase 4 Plan 06 (D-16): the set-as-cover affordance. A small icon
// trigger opens a popover listing the task's own attached images; picking
// one calls PUT /task/anota-cover/:taskId, and a "use earliest photo"
// control clears the override back to Phase 3's D-02 default. The image
// list loads lazily — only while the popover is open — so a board of N
// vehicle cards never fires N requests just because the affordance exists.
import { CameraOff, Check, ImagePlus, RotateCcw } from "lucide-react";
import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getApiUrl } from "@/fetchers/get-api-url";
import { useSetAnotaCover } from "@/hooks/mutations/task/use-set-anota-cover";
import { useAnotaCoverCandidates } from "@/hooks/queries/task/use-anota-cover-candidates";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";

export const ANOTA_VEHICLE_BOARD_SLUG = "vehicles-ro";

type VehicleCoverProps = {
  taskId: string;
  projectId: string;
  coverAssetId: string | null | undefined;
};

const COVER_BAND_CLASS =
  "relative mb-2.5 h-28 w-full overflow-hidden rounded-md";

// Stops a tap on the affordance from also starting a card drag (dnd-kit's
// sortable listeners live on the card's own onPointerDown) or triggering
// the card's onClick navigation — both are wired on ancestors of this band.
function stopCardInteraction(e: React.SyntheticEvent) {
  e.stopPropagation();
}

export function VehicleCover({
  taskId,
  projectId,
  coverAssetId,
}: VehicleCoverProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const [trackedAssetId, setTrackedAssetId] = useState(coverAssetId);
  const [open, setOpen] = useState(false);
  const { canUpdateTasks } = useWorkspacePermission();
  const canPickCover = canUpdateTasks();
  const { data, isLoading } = useAnotaCoverCandidates(taskId, open);
  const { mutateAsync: setCover, isPending } = useSetAnotaCover();

  // Reset the failed flag during render (not an effect) whenever the cover
  // id itself changes, so a stale onError from a previous card's asset
  // never permanently sticks this card on the placeholder branch.
  if (coverAssetId !== trackedAssetId) {
    setTrackedAssetId(coverAssetId);
    setImageFailed(false);
  }

  async function handlePick(assetId: string | null) {
    await setCover({ taskId, projectId, assetId });
    setOpen(false);
  }

  return (
    <div className={COVER_BAND_CLASS}>
      {coverAssetId && !imageFailed ? (
        <img
          src={getApiUrl(`asset/${coverAssetId}`)}
          alt="Vehicle"
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center gap-1.5 border border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-400">
          <CameraOff className="h-4 w-4" />
          <span className="text-xs font-bold tracking-wide">NO PHOTO</span>
        </div>
      )}

      {canPickCover && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            aria-label="Choose vehicle photo"
            // pointer-coarse:after: matches buttonVariants' own touch-target
            // pattern (button.tsx) — a transparent hit-area expansion to the
            // project's 44px minimum on touch, without visually enlarging
            // this small 24px icon.
            className="absolute right-1 bottom-1 flex h-6 w-6 items-center justify-center rounded-full border border-border/60 bg-background/90 text-foreground shadow-sm hover:bg-background pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11"
            onClick={stopCardInteraction}
            onPointerDown={stopCardInteraction}
          >
            <ImagePlus className="h-3.5 w-3.5" />
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-56 p-2"
            onClick={stopCardInteraction}
            onPointerDown={stopCardInteraction}
          >
            {isLoading && (
              <p className="p-2 text-muted-foreground text-xs">
                Loading photos…
              </p>
            )}
            {!isLoading && (data?.images.length ?? 0) === 0 && (
              <p className="p-2 text-muted-foreground text-xs">
                No photos attached yet.
              </p>
            )}
            {!isLoading && (data?.images.length ?? 0) > 0 && (
              <div className="grid grid-cols-3 gap-1.5">
                {data?.images.map((image) => (
                  <button
                    key={image.id}
                    type="button"
                    disabled={isPending}
                    onClick={() => handlePick(image.id)}
                    className="relative aspect-square overflow-hidden rounded border border-border/60"
                  >
                    <img
                      src={getApiUrl(`asset/${image.id}`)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    {image.id === data?.coverAssetId && (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <Check className="h-4 w-4 text-white" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              disabled={isPending}
              onClick={() => handlePick(null)}
              className="mt-2 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-md border border-border/60 px-2 py-2 text-muted-foreground text-xs hover:bg-accent"
            >
              <RotateCcw className="h-3 w-3" />
              Use earliest photo
            </button>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
