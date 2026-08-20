// use-anota-session.ts
//
// D-39 (02.1-04): wraps the fork's existing better-auth React client
// (`authClient.getSession()`) to expose the current person's bearer
// token for calls to the Anota panel Worker door. The token is held in
// a React ref for the lifetime of the component tree only — never
// written to any browser-persisted storage (T-02.1-11) — and is
// re-fetched from `getSession()` every time the panel is opened rather
// than cached indefinitely, so a token that rotated or expired between
// opens is picked up automatically.
import { useCallback, useRef } from "react";
import { authClient } from "@/lib/auth-client";

export interface AnotaSession {
  readonly bearerToken: string;
  readonly userId: string;
}

export function useAnotaSession() {
  // In-memory only (T-02.1-11 grep gate: no browser-persisted storage
  // anywhere under apps/web/src/anota).
  const tokenRef = useRef<string | null>(null);

  const resolveSession = useCallback(async (): Promise<AnotaSession | null> => {
    const { data } = await authClient.getSession();
    const token = data?.session?.token;
    const userId = data?.user?.id;
    if (
      typeof token !== "string" ||
      token.length === 0 ||
      typeof userId !== "string"
    ) {
      tokenRef.current = null;
      return null;
    }
    tokenRef.current = token;
    return { bearerToken: token, userId };
  }, []);

  // Convenience for call sites that only need the header value: reuse the
  // in-memory token if we already resolved one this session, otherwise
  // fetch fresh.
  const getBearerToken = useCallback(async (): Promise<string | null> => {
    if (tokenRef.current) return tokenRef.current;
    const session = await resolveSession();
    return session?.bearerToken ?? null;
  }, [resolveSession]);

  return { resolveSession, getBearerToken };
}
