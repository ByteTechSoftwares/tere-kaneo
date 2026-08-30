import { describe, expect, it, vi } from "vitest";
import { BOARD_SCROLL_CLASSES, createBoardWheelHandler } from "./index";

// docs/found-issues.md:L79 -- focused unit test of the wheel handler
// behavior. Does NOT render the whole KanbanBoard (it needs DndContext, a
// project store and query data) -- instead builds hand-made DOM nodes and
// exercises createBoardWheelHandler directly, faking scrollHeight/
// clientHeight/scrollWidth/clientWidth exactly as chat-window.test.tsx does
// (jsdom reports 0 for every layout metric otherwise).

function defineMetric(el: HTMLElement, prop: string, value: number) {
  Object.defineProperty(el, prop, { value, configurable: true });
}

function makeBoard({
  scrollWidth,
  clientWidth,
}: {
  scrollWidth: number;
  clientWidth: number;
}): HTMLDivElement {
  const board = document.createElement("div");
  defineMetric(board, "scrollWidth", scrollWidth);
  defineMetric(board, "clientWidth", clientWidth);
  board.scrollLeft = 0;
  return board;
}

function makeColumn({
  scrollTop,
  clientHeight,
  scrollHeight,
}: {
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;
}): HTMLDivElement {
  const column = document.createElement("div");
  column.setAttribute("data-column-scroll", "");
  defineMetric(column, "clientHeight", clientHeight);
  defineMetric(column, "scrollHeight", scrollHeight);
  column.scrollTop = scrollTop;
  return column;
}

function makeWheelEvent({
  deltaY,
  deltaX = 0,
  deltaMode = WheelEvent.DOM_DELTA_PIXEL,
  target,
}: {
  deltaY: number;
  deltaX?: number;
  deltaMode?: number;
  target: HTMLElement;
}): WheelEvent {
  const event = new WheelEvent("wheel", {
    deltaY,
    deltaX,
    deltaMode,
    cancelable: true,
  });
  Object.defineProperty(event, "target", { value: target });
  return event;
}

describe("createBoardWheelHandler", () => {
  it("pans the board when the wheel event has no column ancestor", () => {
    const board = makeBoard({ scrollWidth: 2000, clientWidth: 800 });
    const handler = createBoardWheelHandler(board);
    const preventDefault = vi.fn();
    const event = makeWheelEvent({ deltaY: 100, target: board });
    Object.defineProperty(event, "preventDefault", { value: preventDefault });

    handler(event);

    expect(board.scrollLeft).toBe(100);
    expect(preventDefault).toHaveBeenCalled();
  });

  it("leaves scrollLeft untouched when the target is inside a column with remaining vertical room", () => {
    const board = makeBoard({ scrollWidth: 2000, clientWidth: 800 });
    const column = makeColumn({
      scrollTop: 0,
      clientHeight: 200,
      scrollHeight: 500,
    });
    board.appendChild(column);
    const handler = createBoardWheelHandler(board);
    const preventDefault = vi.fn();
    const event = makeWheelEvent({ deltaY: 100, target: column });
    Object.defineProperty(event, "preventDefault", { value: preventDefault });

    handler(event);

    expect(board.scrollLeft).toBe(0);
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it("falls through to the board pan when the column is already scrolled to its bottom", () => {
    const board = makeBoard({ scrollWidth: 2000, clientWidth: 800 });
    const column = makeColumn({
      scrollTop: 300,
      clientHeight: 200,
      scrollHeight: 500,
    });
    board.appendChild(column);
    const handler = createBoardWheelHandler(board);
    const preventDefault = vi.fn();
    const event = makeWheelEvent({ deltaY: 100, target: column });
    Object.defineProperty(event, "preventDefault", { value: preventDefault });

    handler(event);

    expect(board.scrollLeft).toBe(100);
    expect(preventDefault).toHaveBeenCalled();
  });

  it("leaves scrollLeft untouched when the board has no horizontal overflow", () => {
    const board = makeBoard({ scrollWidth: 800, clientWidth: 800 });
    const handler = createBoardWheelHandler(board);
    const preventDefault = vi.fn();
    const event = makeWheelEvent({ deltaY: 100, target: board });
    Object.defineProperty(event, "preventDefault", { value: preventDefault });

    handler(event);

    expect(board.scrollLeft).toBe(0);
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it("lets a real trackpad horizontal gesture through untouched (deltaX dominates deltaY)", () => {
    const board = makeBoard({ scrollWidth: 2000, clientWidth: 800 });
    const handler = createBoardWheelHandler(board);
    const preventDefault = vi.fn();
    const event = makeWheelEvent({ deltaY: 5, deltaX: 40, target: board });
    Object.defineProperty(event, "preventDefault", { value: preventDefault });

    handler(event);

    expect(board.scrollLeft).toBe(0);
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it("scales a DOM_DELTA_LINE wheel notch (Firefox physical mouse) to a real pixel pan, not a ~3px crawl", () => {
    const board = makeBoard({ scrollWidth: 2000, clientWidth: 800 });
    const handler = createBoardWheelHandler(board);
    const preventDefault = vi.fn();
    // Firefox reports a physical mouse-wheel notch as deltaY: 3,
    // deltaMode: DOM_DELTA_LINE (1) -- not a pixel value.
    const event = makeWheelEvent({
      deltaY: 3,
      deltaMode: WheelEvent.DOM_DELTA_LINE,
      target: board,
    });
    Object.defineProperty(event, "preventDefault", { value: preventDefault });

    handler(event);

    // Raw deltaY (3) would be an imperceptible pan -- this asserts the
    // handler scales line-mode deltas to a usable pixel amount instead.
    expect(board.scrollLeft).toBeGreaterThan(3);
    expect(preventDefault).toHaveBeenCalled();
  });
});

// docs/found-issues.md:L79 -- BOARD_SCROLL_CLASSES must reset both
// standard scrollbar properties (re-enabling the WebKit classic scrollbar
// on Chromium) and must no longer declare its own scrollbar-color, which
// is what disabled the WebKit rules in the first place.
describe("BOARD_SCROLL_CLASSES", () => {
  it("resets the standard scrollbar properties and keeps the WebKit thumb rules, with no author scrollbar-color", () => {
    expect(BOARD_SCROLL_CLASSES).toContain("[scrollbar-width:auto]");
    expect(BOARD_SCROLL_CLASSES).toContain("[scrollbar-color:auto]");
    expect(BOARD_SCROLL_CLASSES).toContain("[&::-webkit-scrollbar]:h-2.5");
    expect(BOARD_SCROLL_CLASSES).toContain(
      "[&::-webkit-scrollbar-track]:bg-transparent",
    );
    expect(BOARD_SCROLL_CLASSES).toContain(
      "[&::-webkit-scrollbar-thumb]:rounded-full",
    );
    expect(BOARD_SCROLL_CLASSES).toContain(
      "[&::-webkit-scrollbar-thumb]:bg-border",
    );
    expect(BOARD_SCROLL_CLASSES).not.toContain(
      "[scrollbar-color:var(--border)_transparent]",
    );
  });
});
