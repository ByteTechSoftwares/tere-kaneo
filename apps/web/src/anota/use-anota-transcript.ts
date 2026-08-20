// use-anota-transcript.ts
//
// D-38 (02.1-04): React Query hook against the Plan-01 Worker door's
// GET {VITE_ANOTA_PANEL_URL}/transcript. Fetched once when the panel is
// first opened (`enabled`), never polled while collapsed — the unread
// badge is driven by an in-flight send resolving, not by this hook.
import { useQuery } from "@tanstack/react-query";

export interface AnotaTranscriptTurn {
  readonly senderText: string;
  readonly replyText: string;
  readonly createdAt: number;
}

interface AnotaTranscriptResponse {
  readonly turns: readonly AnotaTranscriptTurn[];
}

export type AnotaTranscriptErrorKind =
  | "config"
  | "auth"
  | "forbidden"
  | "network";

export class AnotaTranscriptError extends Error {
  readonly kind: AnotaTranscriptErrorKind;

  constructor(kind: AnotaTranscriptErrorKind) {
    super(`anota-transcript-error:${kind}`);
    this.kind = kind;
  }
}

// The Worker's `/panel` door base URL — env-substituted at container
// start via the fork's existing KANEO_-prefixed env.sh loop. Includes the
// `/panel` path segment (e.g. `https://<worker>.workers.dev/panel`); this
// hook appends `/transcript`.
const PANEL_BASE_URL = import.meta.env.VITE_ANOTA_PANEL_URL as
  | string
  | undefined;

interface UseAnotaTranscriptOptions {
  readonly enabled: boolean;
  readonly getBearerToken: () => Promise<string | null>;
}

export function useAnotaTranscript({
  enabled,
  getBearerToken,
}: UseAnotaTranscriptOptions) {
  return useQuery<AnotaTranscriptResponse, AnotaTranscriptError>({
    queryKey: ["anota-transcript"],
    enabled,
    // The transcript is fetched once per panel-open, not polled — a fresh
    // full-page reload naturally re-fetches (D-38's "survives reload").
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
    queryFn: async () => {
      if (!PANEL_BASE_URL) throw new AnotaTranscriptError("config");
      const token = await getBearerToken();
      if (!token) throw new AnotaTranscriptError("auth");
      const response = await fetch(`${PANEL_BASE_URL}/transcript`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 401) throw new AnotaTranscriptError("auth");
      if (response.status === 403) throw new AnotaTranscriptError("forbidden");
      if (!response.ok) throw new AnotaTranscriptError("network");
      return (await response.json()) as AnotaTranscriptResponse;
    },
  });
}
