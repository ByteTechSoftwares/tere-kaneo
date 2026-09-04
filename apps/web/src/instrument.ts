import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_SENTRY_DSN;

// skip init if env.sh never replaced the "KANEO_SENTRY_DSN" placeholder
if (dsn && !dsn.startsWith("KANEO_")) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: __APP_VERSION__,
    sendDefaultPii: false,
    ignoreErrors: [
      // Thrown by Safari browser extensions on iOS 18+ injecting content scripts;
      // not caused by kaneo code.
      "Invalid call to runtime.sendMessage()",
      // Thrown by Facebook's in-app browser (Android) navigation performance logger
      // calling postMessage on a destroyed WebView Java bridge; not caused by kaneo code.
      "Error invoking postMessage: Java object is gone",
    ],
    denyUrls: [
      // Errors from third-party affiliate/adware browser extensions that inject
      // scripts fetching from rsc.cdn77.org (e.g. domainList.json); not caused by kaneo code.
      /cdn77\.org/,
    ],
    // Safari's "Load failed" used to be filtered here by message alone, which
    // also silenced actionable TanStack Query fetch failures. The query client
    // already rate-limits network errors via its own cooldown; auth-provider
    // tags its transient session-fetch errors so we can drop only those here.
    beforeSend(event) {
      if (event.tags?.area === "auth.session") return null;
      return event;
    },
    // Session Replay stays OFF, deliberately: Anota is an internal shop tool
    // handling staff activity, not a public product, so recording browser
    // interaction is a privacy call we won't make by SDK default. This
    // applies even once a real VITE_SENTRY_DSN is set. Re-enabling replay is
    // a decision to make explicitly here, not an accident of the SDK default
    // (docs/found-issues.md L23 / fork-notes.md).
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.1,
  });
}
