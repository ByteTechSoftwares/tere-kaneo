import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TaskTitle from "./task-title";

const mockTask = vi.hoisted(() => ({
  current: {
    id: "task-1",
    projectId: "project-1",
    title: "RO 9001 — 2019 Chevy Silverado (Gonzalez)",
  },
}));

const mutateAsync = vi.fn();
const canUpdateTasks = vi.fn(() => true);

vi.mock("@/hooks/queries/task/use-get-task", () => ({
  default: () => ({ data: mockTask.current }),
}));
vi.mock("@/hooks/mutations/task/use-update-task-title", () => ({
  useUpdateTaskTitle: () => ({ mutateAsync }),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ canUpdateTasks: () => canUpdateTasks() }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// docs/found-issues.md:L80 -- the title control is a wrapping auto-growing
// textarea now, not a single-line input; these cases cover the wrap
// surface, the Enter guard, and that the save path (debouncedUpdate ->
// updateTaskTitle) is unchanged.
describe("TaskTitle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockTask.current = {
      id: "task-1",
      projectId: "project-1",
      title: "RO 9001 — 2019 Chevy Silverado (Gonzalez)",
    };
    canUpdateTasks.mockReturnValue(true);
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    cleanup();
    document.body.innerHTML = "";
    mutateAsync.mockReset();
  });

  it("renders the title control as a textarea holding the task title", () => {
    render(<TaskTitle taskId="task-1" />);

    const textarea = screen.getByPlaceholderText(
      "tasks:detail.titlePlaceholder",
    );
    expect(textarea.tagName).toBe("TEXTAREA");
    expect((textarea as HTMLTextAreaElement).value).toBe(
      "RO 9001 — 2019 Chevy Silverado (Gonzalez)",
    );
  });

  it("carries the responsive text-size classes", () => {
    render(<TaskTitle taskId="task-1" />);

    const textarea = screen.getByPlaceholderText(
      "tasks:detail.titlePlaceholder",
    );
    expect(textarea.className).toContain("text-xl md:text-[2rem]");
  });

  it("still calls the debounced save path when a long title is typed", () => {
    render(<TaskTitle taskId="task-1" />);

    const textarea = screen.getByPlaceholderText(
      "tasks:detail.titlePlaceholder",
    ) as HTMLTextAreaElement;

    fireEvent.change(textarea, {
      target: { value: "RO 9001 — 2019 Chevy Silverado (Gonzalez) — repaint" },
    });

    vi.advanceTimersByTime(800);

    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "task-1",
        title: "RO 9001 — 2019 Chevy Silverado (Gonzalez) — repaint",
      }),
    );
  });

  it("does not insert a newline when Enter is pressed", () => {
    render(<TaskTitle taskId="task-1" />);

    const textarea = screen.getByPlaceholderText(
      "tasks:detail.titlePlaceholder",
    ) as HTMLTextAreaElement;

    fireEvent.change(textarea, {
      target: { value: "RO 9001 line one" },
    });
    const keyDownEvent = fireEvent.keyDown(textarea, {
      key: "Enter",
      code: "Enter",
    });

    // preventDefault was called (fireEvent returns false when the default
    // action was prevented for a cancelable event).
    expect(keyDownEvent).toBe(false);
    expect(textarea.value).not.toContain("\n");
  });
});
