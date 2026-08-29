// chat-window.tsx
//
// 02.1-04 (CHAT-01): message list + composer + panel states. Purely
// presentational — all network/session state is owned by
// `<AnotaChatBubble/>` (chat-bubble.tsx) and passed down as props, so an
// in-flight send survives this component unmounting when the panel is
// collapsed mid-turn (the unread-badge requirement).
//
// No streaming (RESEARCH-confirmed): sends are optimistic-append +
// indefinite "Anota is thinking…" indicator + one awaited JSON reply.
import { Paperclip, Send, X } from "lucide-react";
import {
  type ChangeEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import { getInitials } from "@/lib/get-initials";

export type ChatMessageRole = "user" | "anota";

export interface ChatMessage {
  readonly id: string;
  readonly role: ChatMessageRole;
  readonly text: string;
  readonly createdAt: number;
}

export type SendErrorKind = "network" | "offline";

const SUGGESTION_CHIPS = [
  "What's open today?",
  "Create a task",
  "Check a vehicle",
] as const;

// Client-side ceiling, matching the Worker's own MAX_MEDIA_BYTES
// (worker/src/media/panel-media.ts) so the user gets instant feedback
// instead of waiting on a round trip that is guaranteed to fail with
// image_rejected/too-large.
const MAX_PANEL_IMAGE_BYTES = 10 * 1024 * 1024;

// docs/found-issues.md:L44 — the transcript is persistent and survives
// reload/re-open (D-38), so a clock-time-only render leaves a message
// from days ago indistinguishable from one sent a minute ago. Same-day
// messages keep the bare clock time; anything older gains a date.
function formatTimestamp(epochMs: number): string {
  const date = new Date(epochMs);
  const time = date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  const isToday = date.toDateString() === new Date().toDateString();
  if (isToday) return time;
  const day = date.toLocaleDateString([], { month: "short", day: "numeric" });
  return `${day}, ${time}`;
}

interface MessageBubbleProps {
  readonly message: ChatMessage;
  readonly userAvatarUrl?: string;
  readonly userName?: string;
}

function MessageBubble({
  message,
  userAvatarUrl,
  userName,
}: MessageBubbleProps) {
  const isOwn = message.role === "user";
  return (
    <div
      className={cn(
        "flex items-end gap-2",
        isOwn ? "flex-row-reverse" : "flex-row",
      )}
    >
      {isOwn ? (
        <Avatar className="size-6 shrink-0">
          <AvatarImage src={userAvatarUrl} alt={userName ?? ""} />
          <AvatarFallback className="text-[10px]">
            {getInitials(userName, "??")}
          </AvatarFallback>
        </Avatar>
      ) : (
        <img
          src="/anota-mascot.svg"
          alt=""
          aria-hidden="true"
          className="size-6 shrink-0 rounded-full bg-[#141414] p-1"
        />
      )}
      <div
        className={cn(
          "flex flex-col gap-1",
          isOwn ? "items-end" : "items-start",
        )}
      >
        <div
          className={cn(
            "max-w-[85%] whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-foreground text-sm leading-normal",
            isOwn
              ? "bg-[color-mix(in_srgb,var(--primary)_12%,var(--card))]"
              : "border border-border bg-card",
          )}
        >
          {message.text}
        </div>
        <span className="px-1 text-[12px] text-muted-foreground leading-tight">
          {isOwn ? "You" : "Anota"} · {formatTimestamp(message.createdAt)}
        </span>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <output
      aria-live="polite"
      className="flex items-center gap-1 self-start rounded-lg border border-border bg-card px-3 py-2"
    >
      <span className="sr-only">Anota is thinking…</span>
      <span aria-hidden="true" className="flex items-center gap-1">
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
      </span>
    </output>
  );
}

interface EmptyStateProps {
  readonly onSuggestionClick: (text: string) => void;
}

function EmptyState({ onSuggestionClick }: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-[#141414]">
        <img
          src="/anota-mascot.svg"
          alt=""
          aria-hidden="true"
          className="size-8"
        />
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="font-heading font-semibold text-[16px] text-foreground leading-tight">
          Ask Anota anything
        </h2>
        <p className="text-[14px] text-muted-foreground leading-normal">
          Create a task, check on a vehicle, or ask what's open — same as
          texting the shop number.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {SUGGESTION_CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => onSuggestionClick(chip)}
            className="rounded-full border border-border bg-card px-3 py-1.5 text-[14px] text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}

interface StateBannerProps {
  readonly heading: string;
  readonly body?: string;
  readonly tone?: "default" | "destructive";
}

function StateBanner({ heading, body, tone = "default" }: StateBannerProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-1 px-6 py-8 text-center">
      <p
        className={cn(
          "text-[14px] leading-normal",
          tone === "destructive" ? "text-destructive" : "text-foreground",
        )}
      >
        {heading}
      </p>
      {body ? (
        <p className="text-[12px] text-muted-foreground leading-normal">
          {body}
        </p>
      ) : null}
    </div>
  );
}

export interface ChatWindowProps {
  readonly messages: readonly ChatMessage[];
  readonly isLoadingTranscript: boolean;
  readonly isOffAllowlist: boolean;
  readonly isSending: boolean;
  readonly sendError: SendErrorKind | null;
  readonly isOffline: boolean;
  readonly userAvatarUrl?: string;
  readonly userName?: string;
  readonly onSend: (text: string, file?: File) => void;
  readonly onClose: () => void;
}

export function ChatWindow({
  messages,
  isLoadingTranscript,
  isOffAllowlist,
  isSending,
  sendError,
  isOffline,
  userAvatarUrl,
  userName,
  onSend,
  onClose,
}: ChatWindowProps) {
  const [draft, setDraft] = useState("");
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const userScrolledUpRef = useRef(false);

  // docs/found-issues.md:L92 (D-04) — the near-bottom-only guard below was
  // already correct; the sole defect was this effect's empty dependency
  // array, which only fired once on mount. Widened to depend on the
  // rendered messages so a new arrival re-triggers the same guarded jump.
  // biome-ignore lint/correctness/useExhaustiveDependencies: messages is intentionally not read in the body — it re-triggers the effect on every new message
  useEffect(() => {
    const list = listRef.current;
    if (!list || userScrolledUpRef.current) return;
    list.scrollTop = list.scrollHeight;
  }, [messages]);

  const handleScroll = () => {
    const list = listRef.current;
    if (!list) return;
    const distanceFromBottom =
      list.scrollHeight - list.scrollTop - list.clientHeight;
    userScrolledUpRef.current = distanceFromBottom > 48;
  };

  const submitDraft = (text: string) => {
    const trimmed = text.trim();
    if ((!trimmed && !pickedFile) || isSending || isOffline || isOffAllowlist)
      return;
    onSend(trimmed, pickedFile ?? undefined);
    setDraft("");
    setPickedFile(null);
    setFileError(null);
    userScrolledUpRef.current = false;
  };

  const handleFilePick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset the input's value on every pick so re-picking the same file
    // after a rejection still fires a change event.
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_PANEL_IMAGE_BYTES) {
      setPickedFile(null);
      setFileError("That photo is too large — please pick one under 10MB.");
      return;
    }
    setFileError(null);
    setPickedFile(file);
  };

  const clearPickedFile = () => {
    setPickedFile(null);
    setFileError(null);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitDraft(draft);
    }
  };

  const showEmptyState =
    !isLoadingTranscript && !isOffAllowlist && messages.length === 0;
  const composerDisabled = isSending || isOffline || isOffAllowlist;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-border bg-background shadow-lg">
      <header className="flex items-center justify-between border-border border-b px-6 py-4">
        <h1 className="font-heading font-semibold text-[16px] text-foreground leading-tight">
          Anota
        </h1>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close chat"
          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </header>

      {isOffAllowlist ? (
        <StateBanner heading="This chat isn't set up for your account yet — ask Mario to add you." />
      ) : showEmptyState ? (
        <EmptyState onSuggestionClick={submitDraft} />
      ) : (
        <div
          ref={listRef}
          onScroll={handleScroll}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-4"
        >
          {isLoadingTranscript ? (
            <StateBanner heading="Loading your conversation…" />
          ) : null}
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              userAvatarUrl={userAvatarUrl}
              userName={userName}
            />
          ))}
          {isSending ? <TypingIndicator /> : null}
          {sendError === "network" ? (
            <StateBanner
              heading="Anota couldn't reach the shop's board just now."
              body="Try again, or text the shop number instead — nothing was lost."
              tone="destructive"
            />
          ) : null}
        </div>
      )}

      {isOffline ? (
        <div className="border-border border-t px-6 py-2 text-[12px] text-muted-foreground">
          You're offline — reconnect to chat with Anota.
        </div>
      ) : null}

      {!isOffAllowlist ? (
        <div className="flex flex-col gap-2 border-border border-t px-4 py-3">
          {pickedFile ? (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1 text-[12px] text-foreground">
              <span className="truncate">{pickedFile.name}</span>
              <button
                type="button"
                onClick={clearPickedFile}
                aria-label="Remove attached photo"
                className="ml-auto flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </div>
          ) : null}
          {fileError ? (
            <p className="px-1 text-[12px] text-destructive">{fileError}</p>
          ) : null}
          <div className="flex items-end gap-2">
            <label htmlFor="anota-composer" className="sr-only">
              Message Anota
            </label>
            <textarea
              id="anota-composer"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              disabled={composerDisabled}
              rows={1}
              placeholder="Message Anota…"
              className="max-h-32 min-h-9 flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-[14px] text-foreground leading-normal outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-64"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFilePick}
              className="hidden"
            />
            <button
              type="button"
              aria-label="Attach a photo"
              disabled={composerDisabled}
              onClick={() => fileInputRef.current?.click()}
              className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-64"
            >
              <Paperclip className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Send message"
              disabled={
                composerDisabled || (draft.trim().length === 0 && !pickedFile)
              }
              onClick={() => submitDraft(draft)}
              className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-64"
            >
              <Send className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
