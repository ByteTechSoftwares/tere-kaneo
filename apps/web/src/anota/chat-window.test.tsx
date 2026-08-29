import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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

function makeAnotaMessage(id: string, createdAt: number): ChatMessage {
  return { id, role: "anota", text: id, createdAt };
}

// jsdom never loads images, so the fork's Base UI AvatarImage (which only
// mounts after the browser successfully loads its src) never mounts in
// these tests -- AvatarFallback is what renders instead. Assert on the
// fallback initials, not on an img element carrying the avatar URL; do not
// "fix" this by asserting an <img> for the user avatar case.
describe("ChatWindow message avatars (L26)", () => {
  it("renders the mascot img for an Anota-role message", () => {
    const { container } = render(
      <ChatWindow {...baseProps} messages={[makeAnotaMessage("m1", 1)]} />,
    );
    const mascotImgs = container.querySelectorAll(
      'img[src="/anota-mascot.svg"]',
    );
    expect(mascotImgs.length).toBeGreaterThan(0);
  });

  it("renders the user's initials for a user-role message with a name", () => {
    const { container } = render(
      <ChatWindow
        {...baseProps}
        messages={[makeMessage("m1", 1)]}
        userName="Mario Rossi"
      />,
    );
    expect(container.textContent).toContain("MR");
  });

  it("renders no mascot img for a user-role message", () => {
    const { container } = render(
      <ChatWindow
        {...baseProps}
        messages={[makeMessage("m1", 1)]}
        userName="Mario Rossi"
      />,
    );
    const mascotImgs = container.querySelectorAll(
      'img[src="/anota-mascot.svg"]',
    );
    expect(mascotImgs.length).toBe(0);
  });
});

function makeFile(name: string, size: number, type = "image/png"): File {
  const file = new File([new Uint8Array(1)], name, { type });
  // Faking `.size` avoids allocating real megabytes for the oversize case.
  Object.defineProperty(file, "size", { value: size, configurable: true });
  return file;
}

function pickFile(container: HTMLElement, file: File) {
  const input = container.querySelector(
    'input[type="file"]',
  ) as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

describe("ChatWindow composer photo attach", () => {
  it("enables the send button with an empty draft once a file is picked", () => {
    const { container } = render(<ChatWindow {...baseProps} messages={[]} />);
    const sendButton = container.querySelector(
      'button[aria-label="Send message"]',
    ) as HTMLButtonElement;
    expect(sendButton.disabled).toBe(true);

    pickFile(container, makeFile("photo.png", 1024));

    expect(sendButton.disabled).toBe(false);
  });

  it("passes both the text and the picked File to onSend", () => {
    const onSend = vi.fn();
    const { container } = render(
      <ChatWindow {...baseProps} onSend={onSend} messages={[]} />,
    );
    const file = makeFile("photo.png", 1024);
    pickFile(container, file);
    const sendButton = container.querySelector(
      'button[aria-label="Send message"]',
    ) as HTMLButtonElement;

    fireEvent.click(sendButton);

    expect(onSend).toHaveBeenCalledWith("", file);
  });

  it("refuses an oversized file, shows a readable error, and never calls onSend", () => {
    const onSend = vi.fn();
    const { container, getByText } = render(
      <ChatWindow {...baseProps} onSend={onSend} messages={[]} />,
    );
    const oversized = makeFile("huge.png", 11 * 1024 * 1024);

    pickFile(container, oversized);

    expect(getByText(/too large/i)).toBeTruthy();
    const sendButton = container.querySelector(
      'button[aria-label="Send message"]',
    ) as HTMLButtonElement;
    expect(sendButton.disabled).toBe(true);
    fireEvent.click(sendButton);
    expect(onSend).not.toHaveBeenCalled();
  });

  it("keeps an already-valid picked file when a second, oversized pick is rejected (code-review regression)", () => {
    const onSend = vi.fn();
    const { container, getByText } = render(
      <ChatWindow {...baseProps} onSend={onSend} messages={[]} />,
    );
    const valid = makeFile("photo.png", 1024);
    pickFile(container, valid);
    const sendButton = container.querySelector(
      'button[aria-label="Send message"]',
    ) as HTMLButtonElement;
    expect(sendButton.disabled).toBe(false);

    const oversized = makeFile("huge.png", 11 * 1024 * 1024);
    pickFile(container, oversized);

    expect(getByText(/too large/i)).toBeTruthy();
    // The first, still-valid file must remain attached -- the send button
    // stays enabled and the chip is still present, rather than the
    // rejected second pick silently wiping the earlier valid selection.
    expect(sendButton.disabled).toBe(false);
    expect(
      container.querySelector('button[aria-label="Remove attached photo"]'),
    ).toBeTruthy();

    fireEvent.click(sendButton);

    expect(onSend).toHaveBeenCalledWith("", valid);
  });

  it("clears the selection when the chip's remove control is clicked", () => {
    const { container } = render(<ChatWindow {...baseProps} messages={[]} />);
    pickFile(container, makeFile("photo.png", 1024));
    const removeButton = container.querySelector(
      'button[aria-label="Remove attached photo"]',
    ) as HTMLButtonElement;
    expect(removeButton).toBeTruthy();

    fireEvent.click(removeButton);

    const sendButton = container.querySelector(
      'button[aria-label="Send message"]',
    ) as HTMLButtonElement;
    expect(sendButton.disabled).toBe(true);
    expect(
      container.querySelector('button[aria-label="Remove attached photo"]'),
    ).toBeNull();
  });
});
