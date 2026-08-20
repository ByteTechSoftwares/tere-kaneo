// chat-bubble.tsx
//
// D-36 (02.1-04, CHAT-01): the floating Anota launcher, mounted once at
// the app shell (routes/__root.tsx) alongside <Outlet/>. Owns all panel
// state (session, transcript, send/receive, unread badge) so an
// in-flight send survives <ChatWindow/> unmounting when the user
// collapses the panel mid-turn.
//
// Placeholder mascot only (Lucide MessageCircle on the accent fill) —
// the real mascot lands in a later, operator-gated plan (D-42).
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider/hooks/use-auth";
import { cn } from "@/lib/cn";
import {
  type ChatMessage,
  ChatWindow,
  type SendErrorKind,
} from "./chat-window";
import { useAnotaSession } from "./use-anota-session";
import { useAnotaTranscript } from "./use-anota-transcript";

const PANEL_BASE_URL = import.meta.env.VITE_ANOTA_PANEL_URL as
  | string
  | undefined;

function useIsOnline(): boolean {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return isOnline;
}

interface PanelMessageResponse {
  readonly duplicate: boolean;
  readonly replyText: string;
}

export function AnotaChatBubble() {
  const { user } = useAuth();
  const isOnline = useIsOnline();
  const { getBearerToken } = useAnotaSession();

  const [isExpanded, setIsExpanded] = useState(false);
  const isExpandedRef = useRef(isExpanded);
  useEffect(() => {
    isExpandedRef.current = isExpanded;
  }, [isExpanded]);

  const [hasOpenedOnce, setHasOpenedOnce] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [sessionMessages, setSessionMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<SendErrorKind | null>(null);
  const [isOffAllowlist, setIsOffAllowlist] = useState(false);

  const {
    data: transcriptData,
    isLoading: isTranscriptLoading,
    error: transcriptError,
  } = useAnotaTranscript({ enabled: hasOpenedOnce, getBearerToken });

  useEffect(() => {
    if (transcriptError?.kind === "forbidden") setIsOffAllowlist(true);
  }, [transcriptError]);

  const transcriptMessages: ChatMessage[] =
    transcriptData?.turns.flatMap((turn, index) => [
      {
        id: `t-${index}-user`,
        role: "user" as const,
        text: turn.senderText,
        createdAt: turn.createdAt,
      },
      {
        id: `t-${index}-anota`,
        role: "anota" as const,
        text: turn.replyText,
        createdAt: turn.createdAt,
      },
    ]) ?? [];

  const messages = [...transcriptMessages, ...sessionMessages];

  const handleOpen = () => {
    setIsExpanded(true);
    setHasOpenedOnce(true);
    setHasUnread(false);
  };

  const handleClose = () => {
    setIsExpanded(false);
  };

  const handleSend = async (text: string) => {
    if (!PANEL_BASE_URL) {
      setSendError("network");
      return;
    }
    const messageSid = crypto.randomUUID();
    setSessionMessages((prev) => [
      ...prev,
      { id: messageSid, role: "user", text, createdAt: Date.now() },
    ]);
    setIsSending(true);
    setSendError(null);

    try {
      const token = await getBearerToken();
      if (!token) {
        setSendError("network");
        return;
      }
      const response = await fetch(`${PANEL_BASE_URL}/message`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text, messageSid }),
      });
      if (response.status === 403) {
        setIsOffAllowlist(true);
        return;
      }
      if (!response.ok) {
        setSendError("network");
        return;
      }
      const body = (await response.json()) as PanelMessageResponse;
      setSessionMessages((prev) => [
        ...prev,
        {
          id: `${messageSid}-reply`,
          role: "anota",
          text: body.replyText,
          createdAt: Date.now(),
        },
      ]);
      if (!isExpandedRef.current) setHasUnread(true);
    } catch {
      setSendError("network");
    } finally {
      setIsSending(false);
    }
  };

  // Panel is global on every authenticated Kaneo page — nothing renders
  // pre-sign-in.
  if (!user) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      <AnimatePresence>
        {isExpanded ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
            className="pointer-events-auto fixed right-6 bottom-24 h-[min(600px,80vh)] w-[380px] max-w-[95vw]"
          >
            <ChatWindow
              messages={messages}
              isLoadingTranscript={isTranscriptLoading}
              isOffAllowlist={isOffAllowlist}
              isSending={isSending}
              sendError={sendError}
              isOffline={!isOnline}
              onSend={handleSend}
              onClose={handleClose}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <button
        type="button"
        onClick={handleOpen}
        aria-label="Chat with Anota"
        className={cn(
          // `fixed` already establishes a containing block for the
          // absolutely-positioned unread-badge span below — no separate
          // `relative` needed (and adding one risks losing to `fixed` in
          // Tailwind's generated cascade order).
          "pointer-events-auto fixed right-6 bottom-6 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          isExpanded && "pointer-events-none opacity-0",
        )}
      >
        <MessageCircle className="size-6" aria-hidden="true" />
        {hasUnread ? (
          <span
            aria-hidden="true"
            className="-top-0.5 -right-0.5 absolute size-3.5 rounded-full bg-primary ring-2 ring-background"
          />
        ) : null}
      </button>
    </div>
  );
}

export default AnotaChatBubble;
