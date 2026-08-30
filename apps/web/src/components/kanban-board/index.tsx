import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  type DropAnimation,
  defaultDropAnimationSideEffects,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  type UniqueIdentifier,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { produce } from "immer";
import { useEffect, useRef, useState } from "react";
import { useUpdateTask } from "@/hooks/mutations/task/use-update-task";
import { useRegisterShortcuts } from "@/hooks/use-keyboard-shortcuts";
import useBulkSelectionStore from "@/store/bulk-selection";
import useProjectStore from "@/store/project";
import type { ProjectWithTasks } from "@/types/project";
import BulkToolbar from "../bulk-selection/bulk-toolbar";
import Column from "./column";
import TaskCard from "./task-card";

type KanbanBoardProps = {
  project: ProjectWithTasks;
  disableDragDrop?: boolean;
};

// docs/found-issues.md:L79 -- Chromium disables every `::-webkit-scrollbar*`
// pseudo-element rule on any element whose used standard scrollbar
// properties (`scrollbar-width`/`scrollbar-color`) are non-default.
// index.css's global `* { scrollbar-width: thin; scrollbar-color: ... }`
// (and the prior version of this const, which set its own scrollbar-color)
// left those standard properties non-default on the board's scroll
// containers, so the WebKit thumb rules below never engaged and macOS
// overlay scrollbars won -- invisible at rest, a thumb only during an
// active scroll. Resetting both standard properties to `auto` on these two
// containers re-enables the classic WebKit scrollbar engine via ordinary
// class-selector specificity (a class selector beats index.css's universal
// selector), so index.css itself needs no change and gets none (D-25).
// Firefox ignores the WebKit pseudos entirely and falls back to its own
// default scrollbar -- an accepted trade, no @supports branch.
export const BOARD_SCROLL_CLASSES =
  "[scrollbar-width:auto] [scrollbar-color:auto] [&::-webkit-scrollbar]:h-2.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border";

// docs/found-issues.md:L79 -- a column still has vertical room in the
// wheel's direction, so the board must not steal the event from it.
function columnHasVerticalRoom(column: HTMLElement, deltaY: number): boolean {
  if (deltaY > 0) {
    return column.scrollTop + column.clientHeight < column.scrollHeight - 1;
  }
  if (deltaY < 0) {
    return column.scrollTop > 0;
  }
  return false;
}

// docs/found-issues.md:L79 -- a physical mouse wheel on Firefox (Windows/
// Linux) reports deltaMode = DOM_DELTA_LINE with deltaY typically +-3, not a
// pixel value; adding that raw to scrollLeft pans only ~3px per notch,
// leaving the board still effectively unusable with a mouse on that
// browser. Chrome/Safari report DOM_DELTA_PIXEL and are unaffected. This
// scales LINE mode to an approximate line-height in px, and PAGE mode
// (rare; e.g. some scroll-wheel drivers) to one board-width pan.
const WHEEL_LINE_HEIGHT_PX = 16;

function normalizeWheelDelta(
  event: WheelEvent,
  container: HTMLDivElement,
): number {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
    return event.deltaY * WHEEL_LINE_HEIGHT_PX;
  }
  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    return event.deltaY * container.clientWidth;
  }
  return event.deltaY;
}

// docs/found-issues.md:L79 -- wheel-to-horizontal pan for the real board
// container. Exported so board-scroll.test.tsx can exercise the handler
// directly against hand-built DOM nodes, without rendering the whole
// KanbanBoard (which needs DndContext, a project store and query data).
// Must be attached with `addEventListener(..., { passive: false })`, never
// the JSX `onWheel` prop -- React registers that passively, so
// `preventDefault()` inside it is silently ignored.
export function createBoardWheelHandler(
  container: HTMLDivElement,
): (event: WheelEvent) => void {
  return (event: WheelEvent) => {
    // A trackpad already producing a real horizontal gesture must never be
    // doubled by this handler.
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;

    const target = event.target as HTMLElement | null;
    const column = target?.closest<HTMLElement>("[data-column-scroll]");
    if (column && columnHasVerticalRoom(column, event.deltaY)) return;

    if (container.scrollWidth <= container.clientWidth) return;

    event.preventDefault();
    container.scrollLeft += normalizeWheelDelta(event, container);
  };
}

function KanbanBoard({ project, disableDragDrop = false }: KanbanBoardProps) {
  const queryClient = useQueryClient();
  const { setProject } = useProjectStore();
  const {
    setAvailableTasks,
    focusNext,
    focusPrevious,
    focusedTaskId,
    clearFocus,
  } = useBulkSelectionStore();
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const { mutate: updateTask } = useUpdateTask();
  const navigate = useNavigate();

  useEffect(() => {
    if (project?.columns) {
      const allTaskIds = project.columns.flatMap((column) =>
        column.tasks.map((task) => task.id),
      );
      setAvailableTasks(allTaskIds);
    }
  }, [project, setAvailableTasks]);

  useEffect(() => {
    clearFocus();
  }, [clearFocus]);

  const boardRef = useRef<HTMLDivElement>(null);

  // docs/found-issues.md:L79 -- attached imperatively (never JSX onWheel,
  // see createBoardWheelHandler's comment). `project?.columns` is the same
  // gate the loading-skeleton branch below uses; it re-runs this effect the
  // moment boardRef's div actually mounts (the loading render has no board
  // container to attach to).
  useEffect(() => {
    const el = boardRef.current;
    if (!el || !project?.columns) return;
    const handleWheel = createBoardWheelHandler(el);
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [project?.columns]);

  useRegisterShortcuts({
    shortcuts: {
      j: () => {
        focusNext();
        const state = useBulkSelectionStore.getState();
        if (state.focusedTaskId) {
          navigate({ to: ".", search: { taskId: state.focusedTaskId } });
        }
      },
      k: () => {
        focusPrevious();
        const state = useBulkSelectionStore.getState();
        if (state.focusedTaskId) {
          navigate({ to: ".", search: { taskId: state.focusedTaskId } });
        }
      },
      Enter: () => {
        if (focusedTaskId && project) {
          navigate({
            to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
            params: {
              workspaceId: project.workspaceId,
              projectId: project.id,
              taskId: focusedTaskId,
            },
          });
        }
      },
    },
  });

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: disableDragDrop ? 999999 : 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: disableDragDrop ? 999999 : 250,
        tolerance: 10,
      },
    }),
    useSensor(KeyboardSensor),
  );

  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: "0.8",
        },
      },
    }),
    duration: 300,
    easing: "cubic-bezier(0.23, 1, 0.32, 1)",
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || !project?.columns) return;

    const activeId = active.id.toString();
    const overId = over.id.toString();

    const updatedProject = produce(project, (draft) => {
      const sourceColumn = draft?.columns?.find((col) =>
        col.tasks.some((task) => task.id === activeId),
      );
      const destinationColumn = draft?.columns?.find(
        (col) =>
          col.id === overId || col.tasks.some((task) => task.id === overId),
      );

      if (!sourceColumn || !destinationColumn) return;

      const sourceTaskIndex = sourceColumn.tasks.findIndex(
        (task) => task.id === activeId,
      );
      const task = sourceColumn.tasks[sourceTaskIndex];

      sourceColumn.tasks = sourceColumn.tasks.filter((t) => t.id !== activeId);

      if (sourceColumn.id === destinationColumn.id) {
        let destinationIndex = destinationColumn.tasks.findIndex(
          (t) => t.id === overId,
        );
        if (sourceTaskIndex <= destinationIndex) {
          destinationIndex += 1;
        }
        destinationColumn.tasks.splice(destinationIndex, 0, task);

        destinationColumn.tasks.forEach((t, index) => {
          updateTask({ ...t, position: index });
        });

        queryClient.invalidateQueries({
          queryKey: ["projects", project.workspaceId],
        });
      } else {
        // A task's status is a column slug. The column id is only the
        // droppable identity here, and the two are interchangeable only
        // because the tasks endpoint happens to return `id: column.slug`.
        task.status = destinationColumn.slug;
        const destinationIndex =
          overId === destinationColumn.id
            ? destinationColumn.tasks.length
            : destinationColumn.tasks.findIndex((t) => t.id === overId) + 1;

        destinationColumn.tasks.splice(destinationIndex, 0, task);

        destinationColumn.tasks.forEach((t, index) => {
          updateTask({ ...t, status: destinationColumn.slug, position: index });
        });

        sourceColumn.tasks.forEach((t, index) => {
          updateTask({ ...t, position: index });
        });
      }
    });

    setProject(updatedProject);
    setActiveId(null);
  };

  if (!project?.columns) {
    return (
      <div className="flex h-full w-full flex-col bg-linear-to-b from-muted/25 to-background">
        <header className="mb-6 mt-6 space-y-6 shrink-0 px-6">
          <div className="flex items-center justify-between">
            <div className="w-48 h-8 bg-muted/50 rounded-md animate-pulse" />
          </div>
        </header>

        <div className="relative min-h-0 flex-1">
          <div
            // docs/found-issues.md:L79 -- persistent scrollbar, skeleton container
            className={`flex h-full flex-1 gap-4 overflow-x-auto px-4 pb-4 md:px-5 ${BOARD_SCROLL_CLASSES}`}
          >
            {[...Array(4)].map((_, i) => (
              <div
                key={`kanban-column-skeleton-${
                  // biome-ignore lint/suspicious/noArrayIndexKey: It's a skeleton
                  i
                }`}
                className="h-full min-w-80 w-full flex-1 rounded-xl border border-border/70 bg-card"
              >
                <div className="px-4 py-3 flex items-center justify-between">
                  <div className="w-24 h-5 bg-muted/50 rounded animate-pulse" />
                  <div className="w-8 h-5 bg-muted/50 rounded animate-pulse" />
                </div>

                <div className="px-2 pb-4 flex flex-col gap-3 flex-1">
                  {[...Array(3)].map((_, j) => (
                    <div
                      key={`kanban-task-skeleton-${
                        // biome-ignore lint/suspicious/noArrayIndexKey: It's a skeleton
                        j
                      }`}
                      className="p-4 bg-card rounded-lg border border-border/50 animate-pulse"
                    >
                      <div className="space-y-3">
                        <div className="w-2/3 h-4 bg-muted/70 rounded" />
                        <div className="w-1/2 h-3 bg-muted/70 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const activeTask = activeId
    ? project.columns
        .flatMap((col) => col.tasks)
        .find((task) => task.id === activeId)
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full w-full flex-col bg-linear-to-b from-muted/20 to-background">
        <div
          ref={boardRef}
          // docs/found-issues.md:L79 -- persistent scrollbar, real board container
          className={`min-h-0 flex-1 overflow-x-auto [-webkit-overflow-scrolling:touch] ${BOARD_SCROLL_CLASSES}`}
        >
          <div className="flex h-full min-w-max gap-4 px-4 py-4 md:px-5">
            {project.columns?.map((column) => (
              <div
                key={column.id}
                className="h-full max-w-96 min-w-80 shrink-0 flex-1"
              >
                <Column column={column} disableDragDrop={disableDragDrop} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <DragOverlay dropAnimation={dropAnimation}>
        {activeTask ? (
          <div className="transform rotate-1 scale-[1.03] shadow-lg">
            <div className="ring-2 ring-ring/35 rounded-lg">
              <TaskCard task={activeTask} />
            </div>
          </div>
        ) : null}
      </DragOverlay>

      <BulkToolbar />
    </DndContext>
  );
}

export default KanbanBoard;
