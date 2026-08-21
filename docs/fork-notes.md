# Fork Notes

D-25 register: every place this fork deviates from upstream `usekaneo/kaneo` by editing an
upstream file directly (rather than an override/asset-swap seam), why no seam existed, and
what changed. Kept up to date per-phase so future upstream merges know exactly what to
re-check. See `.claude/CLAUDE.md` "Fork discipline" and the shop-ops
`.planning/phases/02.1-in-app-anota-chat-panel-fork-image-pipeline/02.1-CONTEXT.md` (D-25,
D-40).

## Phase 02.1 Plan 02 — Identity rebrand: strings (BRAND-01)

Branch: `anota/02.1-02-rebrand-strings`. Scope: user-visible "Kaneo" text only — name,
copy, page titles. No color/theme token, no internal identifier, no asset filename
changed (D-41, D-25).

### Upstream files edited directly, and why no override seam existed

| File | What changed | Why a direct edit (no seam) |
|---|---|---|
| `apps/web/index.html` | `<title>`, `meta[name=title]`, `meta[name=description]`, `og:title`, `og:description`, `twitter:title`, `twitter:description`, `apple-mobile-web-app-title`, `application-name` | Static HTML, not env-substituted at container start (only `KANEO_API_URL`/`KANEO_CLIENT_URL`/generic `KANEO_*` placeholders are — see `apps/web/env.sh`). No config surface exists for page metadata. |
| `apps/web/public/site.webmanifest` | `name`, `short_name` | Static JSON manifest, same reasoning as above. `theme_color`/`background_color` **left at `#141414`** — that is the existing dark `--background` token, not a new color; changing it would violate D-41. |
| `apps/web/src/components/common/logo.tsx` | `alt` text on both `<img>` tags (dark/light logo) | The `src` filenames (`logo-dark.svg`/`logo-light.svg`) are the asset-swap seam and are **left unchanged** here — swapping the actual logo artwork is Plan 05, gated on brand-kit approval (D-43). Only the accessibility `alt` string, which is hardcoded JSX with no i18n or config indirection, needed a direct edit. |
| `apps/web/src/components/page-title.tsx` | Default `suffix` param, `"Kaneo"` → `"Anota"` | This is the one seam the rest of the app already calls through (every page's `<title>` reads `${title} — ${suffix}`) — a one-line default-parameter edit, not new logic. |
| `apps/web/src/routes/auth/sign-up.tsx` | `defaultValue: "Set up your Kaneo instance"` → `"Set up your Anota instance"` | This is an i18n `t()` call's **fallback string**, not a resolved translation key — `auth:signUp.instanceAdminTitle` does not exist in any `i18n/*.json` file, confirmed by search, so the `defaultValue` literal is what actually renders. No i18n seam to route through. |
| `apps/web/src/routes/mcp.authorize.tsx` | `subtitle="...access to your Kaneo account."` → `"...your Anota account."` | Hardcoded JSX prop, no i18n key. |
| `apps/web/src/routes/device/approve.tsx` | `subtitle="A device is requesting access to your Kaneo account."` → same, "Anota" | Hardcoded JSX prop, no i18n key. |
| `apps/web/src/routes/_layout/_authenticated/dashboard/settings/workspace/billing.tsx` | Line 141 only: `"Self-hosted Kaneo includes every feature, free forever."` → `"Self-hosted Anota includes..."` | See "Billing panel decision" below — this is the only reachable "Kaneo" string on this route given the current deployment's env config; a direct edit was the lowest-risk fix. |
| `i18n/en-US.json` | `common.appName` ("Kaneo" → "Anota"); `common.modals.createWorkspace.breadcrumbKaneo` **value** ("KANEO" → "ANOTA", key name unchanged); and every other reachable user-visible string containing "Kaneo" (onboarding page title, notification/preferences subtitles, developer-settings API-key copy, GitHub/Gitea integration comment copy, generic-webhook hints, Telegram chat-label hint, workspace-invitation email subject/preview/subtitle/footer) | See "The i18n/ discovery" below — this is the actual content source for most `t()`-rendered strings in `apps/web`; the plan's `files_modified` list predates knowledge that these files live at repo-root `i18n/`, not inside `apps/web/src`. Values only; no key renamed. `X-Kaneo-Signature` HTTP header name **preserved** (see below). |
| `i18n/es-ES.json` | Same categories as en-US, restricted to the keys that actually exist in this (smaller, less-synced) locale file: `appName`, `breadcrumbKaneo` value, invite-body, onboarding page title, preferences subtitle, developer-settings API-key copy, GitHub integration comment copy, generic-webhook hints, invitation email block | See "Locale scope decision" below — only the two browser-reachable locales for this team were touched. `X-Kaneo-Signature` preserved here too. |

### The i18n/ discovery (deviation — Rule 2, auto-add missing critical functionality)

The plan's `files_modified` and the UI-SPEC mount-point map were built by grepping
`apps/web/src`, `apps/web/index.html`, `apps/web/public` — and found every hardcoded JSX
string correctly. What neither caught: most of `apps/web`'s UI text is **not** hardcoded —
it resolves through `t("namespace:key")` calls against `i18n/*.json` files that live at the
**repo root** (`apps/web/vite.config.ts` aliases `@i18n` to `../../i18n`, and
`apps/web/src/lib/i18n/index.ts` bundles every locale's JSON directly into the app at build
time). Grepping `apps/web/src` for the literal string "Kaneo" finds the *keys* that happen to
contain the word (e.g. `breadcrumbKaneo`) but not the many keys whose *values* say "Kaneo"
while the key itself is generic (e.g. `preferencesPage.subtitle`, `webhookHint`,
`chatLabelHint`). A second, targeted `rg -n "Kaneo" i18n/` sweep found 20+ additional
user-visible strings across `i18n/en-US.json` alone (onboarding welcome text, notification
preferences, developer settings, GitHub/Gitea/generic-webhook/Telegram integration copy,
and the workspace-invitation email template). This is corrective — same class of change as
every other string edit in this plan — not a scope expansion requiring an operator decision.

### Locale scope decision

`resolveLocale()` (`apps/web/src/lib/i18n/index.ts`) auto-resolves the active locale from
the signed-in browser's language, matching against `supportedLocales`. This team is
trilingual EN/PT/ES (02-CONTEXT D-32). There is **no `pt-*` locale file** in `i18n/`, so a
Portuguese-set browser falls back to `en-US` (the configured `fallbackLng`). The
browser-reachable locale set for this deployment is therefore exactly **`{en-US, es-ES}`** —
both were rebranded in full for every key that exists in each file.

The other 10 locale files (`de-DE`, `el-GR`, `fr-FR`, `id-ID`, `ko-KR`, `mk-MK`, `nl-NL`,
`ru-RU`, `tr-TR`, `uk-UA`) plus `i18n/schema.json` (a dev-tooling JSON-schema file, never
rendered to a user) still contain "Kaneo" strings. **Classified customer-facing-out-of-scope
by construction, not silently skipped**: no team member's browser will ever resolve to one of
these locales, so their content is unreachable in this deployment. Editing all 10 (plus
schema) would be pure upstream-file churn against languages nobody at Tere reads — directly
contrary to D-25's "minimize upstream-file churn, minimize merge-conflict surface" discipline
— for zero user-facing benefit. If Tere ever needs a `pt-*` locale, that is new scope for a
future plan, not a retrofit of this one.

### X-Kaneo-Signature header name — preserved, not a miss

`apps/api/src/plugins/generic-webhook/client.ts` and
`apps/api/src/notification-preferences/delivery.ts` both literally set a request header named
`X-Kaneo-Signature`. The `i18n/*.json` webhook-hint strings that mention this header name were
**left referencing `X-Kaneo-Signature` verbatim** — renaming the string would make the hint
factually wrong, since the header the API actually sends would still be `X-Kaneo-Signature`.
Renaming the literal header itself is an `apps/api` code change, entirely outside this plan's
`apps/web`-only scope (and outside `files_modified`), and would be a breaking change for any
external system already validating that header name. Left as a forward-reference: if Anota's
own webhook signing header is ever renamed, that is `apps/api` scope, tracked separately.

### Billing panel decision

The plan's UI-SPEC flagged the "Kaneo Cloud" upsell copy on the billing settings page and
asked for a reachability/hide-vs-reword decision. Traced the render path
(`apps/web/src/routes/_layout/_authenticated/dashboard/settings/workspace/billing.tsx`,
`apps/api/src/billing/config.ts`):

- `RouteComponent` returns early with **only** the "Billing isn't enabled on this instance"
  message when `billing?.billingEnabled` is false, before ever reaching the "Kaneo Cloud"
  strings.
- `isBillingEnabled()` = `isCloud() && CREEM_API_KEY && CREEM_WEBHOOK_SECRET`. `isCloud()`
  reads `process.env.KANEO_CLOUD === "true"`. This project's `.claude/CLAUDE.md` Kaneo
  Self-Host Requirements table confirms `KANEO_CLOUD` is left unset for this self-hosted
  single-tenant deployment, and no CREEM keys are configured — so `billingEnabled` is
  **always false** here.
- The "Billing" nav item itself is also conditionally excluded from the settings sidebar when
  `config?.billingEnabled` is false (`workspace.tsx` line 72), so the route is not even linked
  from the UI in this deployment — though it remains reachable by direct URL.

**Decision: no additional hide-behind-flag code change was needed** — the plan's preferred
path ("hide behind the already-false `KANEO_CLOUD` flag") is already how the code behaves
natively; adding a redundant conditional would be unnecessary churn against upstream logic
that already does the right thing. The **only** string reachable in this deployment is line
141's "Self-hosted Kaneo includes every feature, free forever." — fixed directly. The three
"Kaneo Cloud" strings (lines 171, 196, 208 — `foundingFree`/`hasSubscription` branches) sit
behind a gate that is structurally unreachable given this deployment's env config, and were
**not edited** — classified customer-facing-out-of-scope/unreachable.

### Public-project reachability finding

The plan asked whether public (unauthenticated) project sharing is reachable before spending
rebrand effort on `kaneo-branding.tsx` ("Powered by Kaneo") and `error-view.tsx`. Traced:
`apps/web/src/routes/_layout/_authenticated/dashboard/settings/projects/$projectId/visibility.tsx`
exposes a per-project `isPublic` toggle to any authenticated project admin, and
`apps/web/src/routes/public-project.$projectId.tsx` is a real, always-registered,
unauthenticated route with no build-time flag gating it. **Finding: reachable** — any
Mario/Kim/tech with admin rights on a project could flip that toggle at any time, at which
point the write-capable Anota system would present a public, unauthenticated share URL. Per
the plan's own instruction ("if it IS reachable, rebrand"), and defense-in-depth given the
[hard] no-customer boundary (a tech accidentally enabling this should still see Anota
branding, not Kaneo), the string was rebranded — via the `i18n` `common.appName` value fix
(Task 1), so `kaneo-branding.tsx` itself needed **no code edit**: it already renders
`{t("publicProject:branding.poweredBy")} {t("common:appName")}`, and `appName` now resolves
to "Anota". The component/file name `KaneoBranding`/`kaneo-branding.tsx` was **left
unchanged** (internal identifier, D-25 — not rendered text, renaming widens merge-conflict
surface for zero user benefit). One residual, out-of-scope-for-this-plan note: the
`<a href="https://kaneo.app">` wrapping "Powered by Anota" still points at the public Kaneo
marketing site — lowercase, not part of the case-sensitive "Kaneo" sweep, and this project's
[hard] boundary means this page should ideally never be reached by an actual customer in the
first place. Flagged, not fixed, in this plan.

### SC5 classification — full `rg -n "Kaneo" apps/web/src apps/web/index.html apps/web/public i18n/` sweep, post-fix

Run at the end of this plan. Every hit below is one of: **fixed** (this plan), **internal
identifier** (D-25, never rendered text), or **customer-facing-out-of-scope** (traced,
documented reason above).

| Hit | Classification |
|---|---|
| `i18n/en-US.json` / `i18n/es-ES.json` `breadcrumbKaneo` **key name** | internal identifier — i18n key names are never rendered; value already fixed |
| `i18n/en-US.json` / `i18n/es-ES.json` `X-Kaneo-Signature` (webhook hint copy) | customer-facing-out-of-scope — literal `apps/api` HTTP header name, preserved intentionally (see above) |
| `i18n/{de-DE,el-GR,fr-FR,id-ID,ko-KR,mk-MK,nl-NL,ru-RU,tr-TR,uk-UA}.json` (all remaining "Kaneo" strings) | customer-facing-out-of-scope — browser-unreachable locales for this team (see "Locale scope decision") |
| `i18n/schema.json` (`title`, `breadcrumbKaneo` property name) | internal identifier — dev-tooling JSON Schema, never rendered to a user |
| `apps/web/src/routes/.../billing.tsx` lines 171/196/208 ("Kaneo Cloud...") | customer-facing-out-of-scope — structurally unreachable given `billingEnabled` gate (see "Billing panel decision") |
| `apps/web/src/routes/public-project.$projectId.tsx` import/usage of `KaneoBranding` | internal identifier — component/file name, not rendered text; the text it renders is fixed via `i18n` |
| `apps/web/src/components/public-project/error-view.tsx` import/usage of `KaneoBranding` | internal identifier — same as above |
| `apps/web/src/components/public-project/kaneo-branding.tsx` — `export function KaneoBranding()` | internal identifier — component name, D-25, left unchanged |
| `apps/web/src/components/task/extensions/kaneo-issue-link.tsx` — `KaneoIssueLink`, `.kaneo-issue-link-*` classes | internal identifier — TipTap extension export + CSS classes, D-25, explicitly listed as out-of-scope in UI-SPEC |
| `apps/web/src/components/task/extensions/kaneo-mention.tsx` — `KaneoMention`, `.kaneo-mention` class | internal identifier — same as above |
| `apps/web/src/components/task/task-description.tsx`, `apps/web/src/components/activity/comment-editor.tsx` — imports/usages of `KaneoIssueLink`/`KaneoMention` | internal identifier — same as above |
| `apps/web/src/components/shared/modals/create-workspace-modal.tsx` line 91 — `t("common:modals.createWorkspace.breadcrumbKaneo")` | internal identifier — the i18n key reference itself; the VALUE it resolves to is fixed |

Every other user-visible "Kaneo" string found in `apps/web/index.html`,
`apps/web/public/site.webmanifest`, and the full `apps/web/src` + `i18n/en-US.json` +
`i18n/es-ES.json` sweep is **fixed** (see table above). No unclassified hit remains.

### Environment/tooling notes (informational — pre-existing, not fixed by this plan)

Per the SCOPE BOUNDARY on out-of-scope discoveries, these are logged, not fixed, since they
predate and are unrelated to this plan's string-only changes:

- **`packages/permissions` needed a one-time local `pnpm build`** (`tsc`, emits `dist/`) —
  this is a workspace package with no prebuilt artifact checked in; without building it once,
  `apps/web`'s typecheck fails with "Cannot find module '@kaneo/permissions'". This is normal
  monorepo bootstrap, not a defect, and was done once locally to unblock verification (not
  committed — `dist/` is gitignored).
- **`apps/web` `tsc --noEmit` still reports ~38 pre-existing type errors** unrelated to any
  file this plan touched (Better-Auth/`@base-ui` type-version drift, a `roles.tsx`
  Accordion-prop mismatch, several `asChild`-prop and fetcher-type issues). Confirmed none of
  the 38 errors reference any file in this plan's `files_modified`. `apps/web`'s **`vite
  build`** (the actual deploy artifact) succeeds cleanly and the built `dist/index.html` /
  `dist/site.webmanifest` correctly render "Anota" everywhere "Kaneo" appeared before.
- **`pnpm i18n:check` reports pre-existing missing/extra-key gaps across all 11 non-English
  locales** (e.g. `de-DE` is missing the entire `settings:workspaceLabels`/`workspaceRoles`
  section) — this is upstream's translation corpus lagging its English source, unrelated to
  this plan's value-only edits (no key was added, removed, or renamed by this plan). `en-US`
  itself reports zero issues (it is the reference locale); `es-ES` reports a handful of
  pre-existing gaps unrelated to the strings this plan touched.
- Both `pnpm exec biome ci .` and `pnpm run build` (the two pre-commit hook steps) pass
  cleanly against the full working tree with this plan's changes staged.

### Forward references

- **Plans 01/04** (in-app chat panel mount): added new Anota-namespaced component files
  under `apps/web/src/anota/` — no upstream-file edits beyond the app-shell mount point
  (per D-40 override-first). Documented in the Plan 02.1-04 section below (not this
  register's scope at the time it was written; see git history for that plan's own commit).

## Phase 02.1 Plan 05 — Brand assets + mascot placements + CI image pipeline (BRAND-01, INFRA-08)

Branch: `anota/02.1-05-brand-image`. Scope: the operator-approved brand kit
(`docs/brand-kit.md`, approved 2026-08-20) applied to the fork as content swaps under
existing filenames (D-40's preferred, lowest-churn path — no component logic or path
edit), plus the mascot's three D-42 placements, plus the from-scratch CI image pipeline.

### Asset content swap (D-40 asset-swap seam, zero upstream-file path edits)

The nine approved files from `docs/brand-assets/` (shop-ops repo) were copied
byte-for-byte into `apps/web/public/` under their existing filenames — `favicon.svg`,
`favicon.ico`, `favicon-96x96.png`, `apple-touch-icon.png`, `logo-light.svg`,
`logo-dark.svg`, `web-app-manifest-192x192.png`, `web-app-manifest-512x512.png` — plus
the new `anota-mascot.svg`. Verified byte-identical (`cmp`) against the source
immediately after copy. No `index.html`/`site.webmanifest`/`logo.tsx` path edit was
needed — Plan 02 already pointed every one of those references at these exact filenames
in anticipation of this swap.

### Mascot placements (D-42 — exactly the three specified, no more)

| Placement | File | Mechanism |
|---|---|---|
| Chat-bubble launcher avatar (default/idle state) | `apps/web/src/anota/chat-bubble.tsx` | Replaced the placeholder Lucide `MessageCircle` with `<img src="/anota-mascot.svg">`. The launcher's background changed from the theme-following `bg-primary` to a fixed `bg-[#141414]` — see "Fixed-dark mascot ground" below. |
| Panel empty state | `apps/web/src/anota/chat-window.tsx` | Same swap in `EmptyState`: `MessageCircle` → mascot `<img>`, container background fixed to `bg-[#141414]`. |
| Login screen, supplementing the wordmark | `apps/web/src/components/auth/layout.tsx` | Added a new mascot tile (`bg-[#141414]` rounded square) above the existing `<Logo>` — the wordmark is unchanged, the mascot is additive per D-42's "supplements, does not replace" instruction. |

No other placement was added (no favicon, no loading spinner, no page header) — matching
the UI-SPEC's explicit "D-42's list is deliberately short."

### Fixed-dark mascot ground — a deliberate deviation from the UI-SPEC's `--primary` usage

`docs/brand-kit.md` (Plan 03, written after the UI-SPEC's Color contract was locked)
specifies the mascot's body has no background of its own and is "specified to sit on a
constant dark ground in both themes — the launcher circle, the login tile, and the
empty-state container are all ours to colour, and a fixed-colour launcher is what every
chat widget does." `var(--primary)` is theme-following (`neutral-800` light /
`neutral-100` dark per the UI-SPEC Color contract) — using it as the launcher/empty-state
container fill would put the light-mode-dark mascot on a *light* background in dark mode,
exactly the failure the brand kit calls out. All three mascot-hosting containers
(launcher, empty state, login tile) were changed to a fixed `bg-[#141414]` instead. This
is an inline Tailwind arbitrary value, not a new CSS variable/token — D-41 ("no custom
recolor," no new token in `index.css`) is respected; the two source documents were
reconciled in favor of the more specific, later brand-kit instruction. The
unread-message badge, composer send button, and bubble-launcher focus ring remain on
`var(--primary)`/`var(--ring)` exactly as the UI-SPEC's Color contract specifies — only
the mascot-hosting fill changed.

### SC5 sweep — post-application, full re-run

Command: `rg -n "Kaneo" apps/web/src apps/web/index.html apps/web/public`. Every hit is
one of: already classified by Plan 02's table above, or newly classified below (both new
categories are test-only/comment-only, never rendered to a user):

| Hit | Classification |
|---|---|
| `apps/web/src/routes/invitation/accept.$inviteId.test.tsx:48` (`workspaceName: "Kaneo"`) | internal identifier — test fixture literal, never shipped in the production bundle (`*.test.tsx` is excluded from the Vite build) |
| `apps/web/src/lib/generate-project-id.test.ts:6,15` (`generateProjectSlug("Kaneo")`) | internal identifier — same, test fixture only |
| `apps/web/src/anota/chat-bubble.tsx:164` (code comment `// ...authenticated Kaneo page...`) | internal identifier — source comment, never rendered; will be corrected opportunistically on next touch of this file, not worth a separate edit here |
| Every hit in Plan 02's own table (billing.tsx Kaneo-Cloud copy, `KaneoBranding`/`KaneoIssueLink`/`KaneoMention` identifiers, `breadcrumbKaneo` key reference) | unchanged — re-confirmed still classified, still accurate |

No unclassified user-visible hit remains.

### Fork typecheck/build

`pnpm build` inside `apps/web` (the actual deploy artifact per this repo's own
precedent) succeeded cleanly in 6.15s. `dist/index.html`, `dist/site.webmanifest`, and
every copied asset filename are present in the build output and correctly reference
"Anota" throughout. `dist/` is gitignored, not committed.

### CI image pipeline (INFRA-08)

See the Plan 05 CI section below (added alongside this one, same branch/PR) for
`build-image.yml`, the Actions re-enable/inherited-workflow-disable, and the pinned GHCR
image build.
