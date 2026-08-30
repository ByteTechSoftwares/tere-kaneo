import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TaskTitle from "./task-title";

const mockTask = vi.hoisted(() => ({
  current: {
    id: "task-1",
    projectId: "project-1",
    title: "RO 9001 — 2019 Chevy Silverado (Gonzalez)",
  } as
    | {
        id: string;
        projectId: string;
        title: string;
      }
    | undefined,
}));

// docs/found-issues.md:L80 -- a hand-built ResizeObserver stand-in. jsdom
// has no real ResizeObserver implementation; this records every instance
// so a test can grab the one task-title.tsx created and fire its callback
// directly with a fake contentRect width, exactly like a real width change.
class ResizeObserverStub {
  static instances: ResizeObserverStub[] = [];
  private readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    ResizeObserverStub.instances.push(this);
  }

  observe() {}
  unobserve() {}
  disconnect() {}

  trigger(width: number) {
    this.callback(
      [{ contentRect: { width } } as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }
}

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
    ResizeObserverStub.instances = [];
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver =
      ResizeObserverStub;
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    cleanup();
    document.body.innerHTML = "";
    mutateAsync.mockReset();
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = undefined;
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

  // docs/found-issues.md:L80 -- the mount resync measures once, too early:
  // at narrow width the task-detail dialog hasn't finished its entrance
  // layout, so a transiently-wide textarea pins a one-line height that
  // never gets re-measured once the settled width wraps the title. These
  // cases cover the ResizeObserver-driven fix directly against the stub.
  it("re-syncs the pinned height when the observed width changes", () => {
    render(<TaskTitle taskId="task-1" />);

    const textarea = screen.getByPlaceholderText(
      "tasks:detail.titlePlaceholder",
    ) as HTMLTextAreaElement;
    // jsdom reports 0 for every layout metric -- fake scrollHeight the
    // same way board-scroll.test.tsx fakes its container metrics, and pin
    // an inline height standing in for the too-early one-line measurement
    // (25px in the live-diagnosed evidence).
    Object.defineProperty(textarea, "scrollHeight", {
      value: 48,
      configurable: true,
    });
    textarea.style.height = "25px";

    const observer = ResizeObserverStub.instances.at(-1);
    expect(observer).toBeDefined();
    observer?.trigger(300);

    expect(textarea.style.height).toBe("48px");
  });

  it("does not re-run the resync when the observed width is unchanged", () => {
    render(<TaskTitle taskId="task-1" />);

    const textarea = screen.getByPlaceholderText(
      "tasks:detail.titlePlaceholder",
    ) as HTMLTextAreaElement;
    Object.defineProperty(textarea, "scrollHeight", {
      value: 48,
      configurable: true,
    });

    const observer = ResizeObserverStub.instances.at(-1);
    expect(observer).toBeDefined();
    observer?.trigger(300);
    // Simulate something else having since set an unrelated inline
    // height -- if the observer re-entered on its own resync write, this
    // would get overwritten back to "48px" on the second, same-width fire.
    textarea.style.height = "25px";
    observer?.trigger(300);

    expect(textarea.style.height).toBe("25px");
  });

  it("renders without throwing when ResizeObserver is unavailable", () => {
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = undefined;

    expect(() => render(<TaskTitle taskId="task-1" />)).not.toThrow();

    const textarea = screen.getByPlaceholderText(
      "tasks:detail.titlePlaceholder",
    );
    expect(textarea.tagName).toBe("TEXTAREA");
  });

  // docs/found-issues.md:L80 -- round 2. The 06-05 ResizeObserver fix
  // measures correctly but never gets a WIDTH change on the mount path:
  // its first observation lands at the same too-early moment the
  // title-keyed effect already fired, records that width, and the
  // lastWidthRef guard then blocks every later call because the width
  // never changes again. This case reproduces the real ordering -- no
  // task on first paint, the task (and its title) arriving on a second
  // render, exactly as the query resolving does in production -- with
  // both width-based (ResizeObserver) and font-based mechanisms disabled,
  // so only a trigger tied to the rendered VALUE can satisfy it.
  it("re-syncs the pinned height when the task title value arrives after the first paint", () => {
    mockTask.current = undefined;
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = undefined;
    const originalDocumentFonts = document.fonts;
    Object.defineProperty(document, "fonts", {
      value: undefined,
      configurable: true,
    });

    const { rerender } = render(<TaskTitle taskId="task-1" />);

    const textarea = screen.getByPlaceholderText(
      "tasks:detail.titlePlaceholder",
    ) as HTMLTextAreaElement;

    const wrappingTitle =
      "Order brake pads — RO 9001 Silverado (via SMS from Diogo Silva Sena)";

    // A real scrollHeight distinguishes a too-early measurement (empty
    // value, one line) from a settled one (the full wrapping title, two
    // lines) -- a static faked number can't make that distinction, which
    // is precisely the distinction this case exists to prove.
    Object.defineProperty(textarea, "scrollHeight", {
      configurable: true,
      get(this: HTMLTextAreaElement) {
        return this.value === wrappingTitle ? 48 : 25;
      },
    });

    mockTask.current = {
      id: "task-1",
      projectId: "project-1",
      title: wrappingTitle,
    };
    rerender(<TaskTitle taskId="task-1" />);

    // The value landed (so a failure below can't be blamed on the mock),
    // then the height that should have been re-measured against it.
    expect(textarea.value).toBe(wrappingTitle);
    expect(textarea.style.height).toBe("48px");

    Object.defineProperty(document, "fonts", {
      value: originalDocumentFonts,
      configurable: true,
    });
  });
});
