import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { type ChatMessage, ChatWindow } from "./chat-window";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

function makeMessage(id: string, createdAt: number): ChatMessage {
  return { id, role: "user", text: id, createdAt };
}

const baseProps = {
  isLoadingTranscript: false,
  isOffAllowlist: false,
  isSending: false,
  sendError: null,
  isOffline: false,
  onSend: () => {},
  onClose: () => {},
};

// docs/found-issues.md:L92 (D-04) — the near-bottom guard (userScrolledUpRef,
// handleScroll, the 48px threshold) was already correct; the only defect was
// the scroll-to-bottom effect's empty dependency array. These two cases
// exercise both halves of the widened `[messages]` dependency directly.
describe("ChatWindow scroll behaviour (D-04)", () => {
  it("scrolls the list to the bottom when a new message arrives and the user has not scrolled up", () => {
    const { container, rerender } = render(
      <ChatWindow {...baseProps} messages={[makeMessage("m1", 1)]} />,
    );
    const list = container.querySelector(".overflow-y-auto") as HTMLDivElement;
    Object.defineProperty(list, "scrollHeight", {
      value: 500,
      configurable: true,
    });
    Object.defineProperty(list, "clientHeight", {
      value: 200,
      configurable: true,
    });

    rerender(
      <ChatWindow
        {...baseProps}
        messages={[makeMessage("m1", 1), makeMessage("m2", 2)]}
      />,
    );

    expect(list.scrollTop).toBe(500);
  });

  it("does not move the scroll position when a new message arrives while the user has scrolled up beyond the 48px near-bottom threshold", () => {
    const { container, rerender } = render(
      <ChatWindow {...baseProps} messages={[makeMessage("m1", 1)]} />,
    );
    const list = container.querySelector(".overflow-y-auto") as HTMLDivElement;
    Object.defineProperty(list, "scrollHeight", {
      value: 500,
      configurable: true,
    });
    Object.defineProperty(list, "clientHeight", {
      value: 200,
      configurable: true,
    });
    // distanceFromBottom = 500 - 0 - 200 = 300, well past the 48px threshold.
    list.scrollTop = 0;
    fireEvent.scroll(list);

    // Sentinel: move scrollTop to a value the jump-to-bottom effect would
    // never produce, so an unwanted overwrite is unmistakable.
    list.scrollTop = 42;

    rerender(
      <ChatWindow
        {...baseProps}
        messages={[makeMessage("m1", 1), makeMessage("m2", 2)]}
      />,
    );

    expect(list.scrollTop).toBe(42);
  });
});
