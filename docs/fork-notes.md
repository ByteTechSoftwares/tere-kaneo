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

GitHub Actions was disabled on `ByteTechSoftwares/tere-kaneo` (a fork setting, since
2026-08-11) so the 12-13 inherited upstream workflow files stayed dormant despite living
in the repo (D-25: keep the files, don't delete -- they're needed for future upstream
merges to reconcile against). This plan:

1. Re-enabled Actions (`PUT /repos/ByteTechSoftwares/tere-kaneo/actions/permissions`,
   `enabled: true, allowed_actions: all`).
2. **Immediately** disabled every inherited workflow file individually
   (`gh workflow disable <file>`), before any of them could fire: `auto-assign.yml`,
   `auto-merge.yml`, `ci.yml`, `deploy-site.yml`, `docker.yml`, `helm-chart.yml`,
   `issue-notify.yml`, `nightly.yml`, `publish-mcp.yml`, `publish-planka-import.yml`,
   `release-notify.yml`, `release.yml`, `update-contributors.yml` (13 files -- the
   CONTEXT.md estimate of "12" undercounted by one; `publish-planka-import.yml` is a
   newer addition from the v2.21.0 upstream merge (02.1-01) not present when that
   estimate was written). All 13 confirmed `disabled_manually` via
   `gh workflow list --all`.
3. Added `.github/workflows/build-image.yml` -- the fork's own pinned-image pipeline,
   modeled on upstream's `docker.yml` (Pattern 3 in 02.1-RESEARCH.md) but narrowed to a
   single target: `workflow_dispatch` only (no `push`/`pull_request` trigger, so
   re-enabling Actions cannot fire a build), a required `version` string input, job
   permissions scoped to `contents: read` + `packages: write` (no broader token scope),
   pinned action versions (`checkout@v7.0.1`, `setup-buildx-action@v4`,
   `login-action@v4`, `metadata-action@v6`, `build-push-action@v7`), `linux/amd64` only
   (upstream's `arm64` leg dropped -- a Render deploy target doesn't need it), image
   name `bytetechsoftwares/tere-kaneo`, and a single version-pinned tag from the
   `version` input (no `latest` tag, unlike upstream's optional `latest` toggle --
   deliberately omitted per D-25 "never :latest").
4. GHCR auth: tried the default `secrets.GITHUB_TOKEN` first (Pitfall 6's
   recommendation), scoped via the job's `packages: write` permission -- **not** the
   PAT (`GH_PACKAGE_TOKEN`) upstream's own `docker.yml` uses. See the Task 3 section
   below for whether the default token succeeded or a PAT fallback was required.

### CI image build result (Task 3)

Built from fork `main` @ `566455a1` (PR #4 merge commit) via `gh workflow run
build-image.yml -f version=1.0.0`. Run `32445586105`, watched to a terminal state
(`gh run watch --exit-status`), `conclusion: success` -- the default `secrets.GITHUB_TOKEN`
had `packages: write` on this org's GHCR (Assumption A1 in 02.1-RESEARCH.md confirmed;
no PAT fallback / `GH_PACKAGE_TOKEN` secret was needed).

`ghcr.io/bytetechsoftwares/tere-kaneo:1.0.0` verified present and pullable in GHCR by two
independent checks, not the Actions log alone: (1) `gh api
orgs/ByteTechSoftwares/packages/container/tere-kaneo/versions` shows tag `1.0.0` on
digest `sha256:154336efecf9564baca3eac6f51f099db376f897f1b3106d76492e9a6cb5f6dc`; (2)
`docker manifest inspect ghcr.io/bytetechsoftwares/tere-kaneo:1.0.0` (authenticated via
`gh auth token`) returned a real OCI image index with a `linux/amd64` manifest, not an
`unauthorized`/404 error. Package visibility: `private`, ByteTech org.

Full detail, rollback tag, and version-scheme note: `deploy/render.md`'s 2026-08-21
version-bump log entry (shop-ops repo). The live Render service was not touched -- no
Render API call was made from this plan.

**2026-08-21 follow-up:** removed the standalone mascot tile (`/anota-mascot.svg` in its
own dark rounded tile, added by this plan) from `apps/web/src/components/auth/layout.tsx`
-- it duplicated the mascot already present inside the `<Logo>` wordmark directly below it
on the login screen (operator request). The `<Logo>` line is untouched; the mascot glyph
remains everywhere else it was placed (bubble, empty states). Shipped as
`ghcr.io/bytetechsoftwares/tere-kaneo:1.0.1`, deploy detail in `deploy/render.md`
(shop-ops repo).

## Phase 03 Plan 02 — Vehicle-card cover thumbnail (PHOTO-04)

Branch: `anota/03-02-vehicle-cover`. Scope: cover thumbnail on the vehicles board only.

### Upstream files edited directly, and why no override seam existed

| File | What changed | Why a direct edit (no seam) |
|---|---|---|
| `apps/api/src/task/controllers/get-tasks.ts` | One asset query (`assetTable` filtered to `kind = "image"`, ordered oldest-first) and one map construction (`buildTaskCoverMap`), then `coverAssetId` added to all three task-mapping spreads (`columns[].tasks`, `archivedTasks`, `plannedTasks`) | No seam: the board payload is assembled entirely inside this controller and there is no plugin/decorator point that can add a field to it. All reusable logic was moved into the new `anota-vehicle-cover.ts` to keep this edit minimal. |
| `apps/web/src/components/kanban-board/task-card.tsx` | One import plus one slug-gated render (`project?.slug === ANOTA_VEHICLE_BOARD_SLUG`) above the title block | No seam: `TaskCard` is the single card renderer for BOTH boards with no per-board component split and no render-slot prop, so a mount point inside it is the only way to reach the vehicles board without also changing the task board. |

Fork-owned (not upstream edits): `apps/api/src/task/controllers/anota-vehicle-cover.ts`
(new, exports `buildTaskCoverMap`), `tests/api/task/anota-vehicle-cover.test.ts` (new),
`apps/web/src/components/kanban-board/vehicle-cover.tsx` (new, exports
`ANOTA_VEHICLE_BOARD_SLUG` and `VehicleCover`), `apps/web/src/components/kanban-board/vehicle-cover.test.tsx`
(new), and the one-line optional `coverAssetId` field added to `apps/web/src/types/task/index.ts`.

**Upstream-merge re-check note:** `coverAssetId` is optional on the web `Task` type, so a
future upstream merge that rewrites `get-tasks.ts`'s three task-mapping spreads
(`columns[].tasks`, `archivedTasks`, `plannedTasks`) would silently drop the field with
**no type error** and thumbnails would simply vanish. Re-check all three spread sites on
every future D-25 upstream merge.

### CI image build result (Task 3)

Built from fork `main` (post-merge of this plan's PR) via `gh workflow run
build-image.yml -f version=1.1.0`. `1.1.0` is a minor bump over the live `1.0.1` because
this adds a feature; ByteTech's image line is versioned independently of upstream's
numbers and is never `:latest` (D-25).

Full run id, GHCR verification, and rollback tag: `deploy/render.md`'s Phase 03 Plan 02
row (shop-ops repo). The live Render service was **not** touched by this plan -- no
Render API call was made -- production stays on `1.0.1` until plan 03-05's gated
cutover.

## Phase 06 -- Shop-device UX batch (L79, L80, L26, L74)

Branch: `gsd/06-shop-device-ux-batch`. Four found-issues entries batched into one PR and
one image release, per the phase's own success criterion: board unusable with a mouse
(L79), task title clips on phone (L80), panel messages have no sender avatar (L26), and
the panel composer cannot attach a photo (L74).

### Upstream files edited directly, and why no override seam existed

| File | What changed | Why a direct edit (no seam) |
|---|---|---|
| `apps/web/src/components/kanban-board/index.tsx` | Added a module-local `BOARD_SCROLL_CLASSES` const (persistent WebKit/Firefox scrollbar styling) applied to both board `overflow-x` containers, plus an exported `createBoardWheelHandler` factory wired via an imperative `wheel` listener (`useRef`/`useEffect`, never JSX `onWheel` -- React registers that passively) | No seam: `KanbanBoard` is the single board renderer with no render-slot prop or plugin point for scroll behavior; the new logic is two small additions (a class-string const, an exported pure handler factory) rather than a rewrite of the component |
| `apps/web/src/components/kanban-board/column/index.tsx` | One `data-column-scroll` attribute added to the column's existing vertical-scroll `div` (no other change) | No seam: the board's wheel handler needs a DOM marker to find each column's own scroll region via `closest()`; a data attribute on the existing element is the minimal way to expose that without a new prop threaded through `Column` |
| `apps/web/src/components/task/task-title.tsx` | Swapped the fixed-size single-line `<input type="text">` for an auto-growing `<textarea>` at a responsive size, with a `useLayoutEffect` (mount/task-switch resize) plus an inline `onChange` resize (per-keystroke); the existing debounced save path is untouched | No seam: `TaskTitle` is the only title control on the task detail view, and the control-swap is intrinsic to the fix -- there is no wrapper/decorator point that could change the rendered form element from outside this file |

Fork-owned (not upstream edits, all inside the existing `apps/web/src/anota/`
Anota-namespaced directory or new test files): `apps/web/src/anota/chat-window.tsx`
(sender avatars + composer photo affordance), `apps/web/src/anota/chat-bubble.tsx`
(base64 image encode into the existing panel POST), `apps/web/src/anota/read-image-file.ts`
(new, `File` -> base64 helper) and its test, plus new test files
`apps/web/src/components/kanban-board/board-scroll.test.tsx` and
`apps/web/src/components/task/task-title.test.tsx`. The Worker-side panel `image` field
contract (`worker/src/media/panel-media.ts` and siblings) lives in the shop-ops repo, not
this fork -- see that repo's `06-02-SUMMARY.md`.

### Local gate output (pre-merge, this plan)

`pnpm --filter @kaneo/web typecheck` -- exit 0. `pnpm --filter @kaneo/web exec biome
check .` -- "Checked 607 files... No fixes applied", exit 0. `pnpm --filter @kaneo/web
test` (whole suite) -- 174 passed / 8 failed (182 total); all 8 failures are in
`src/hooks/use-board-sort.test.tsx` and `src/hooks/use-task-filters-with-labels-support.test.tsx`,
a pre-existing Node/jsdom `localStorage` teardown defect tracked as shop-ops
`docs/found-issues.md` **L37** (`[open]` since 2026-08-23, zero overlap with any file this
phase touched, reproduced failing in isolation independent of this branch). Every
anota/kanban/task-title suite this phase added or touched passes. Only `build-image.yml`
is active on this repo (every inherited upstream workflow, including `ci.yml`, is
disabled), so these three local gates are the merge bar -- the PR itself reports no
checks, which is the expected terminal state on this repo.

### Pre-merge code-review found two real bugs, fixed same session

A mandatory pre-ship `code-review` pass (satisfying this session's `pr-verify-gate`
review-class requirement) found two correctness bugs in this batch's own diff before
merge, both fixed with a regression test each:

1. **`kanban-board/index.tsx`'s wheel handler ignored `WheelEvent.deltaMode`.** Firefox on
   Windows/Linux reports a physical mouse-wheel notch as `deltaY: ~3`,
   `deltaMode: DOM_DELTA_LINE` (not a pixel value) -- adding that raw to `scrollLeft`
   panned the board by only ~3px per notch, leaving it still effectively unusable with a
   mouse on that browser (the exact L79 symptom this change exists to fix). Chrome/Safari
   report `DOM_DELTA_PIXEL` and were unaffected, which is why local manual testing on this
   session's own browser didn't surface it. Fixed with a `normalizeWheelDelta` helper that
   scales `DOM_DELTA_LINE` to an approximate line-height in px and `DOM_DELTA_PAGE` to one
   board-width pan; new test `board-scroll.test.tsx`'s
   `"scales a DOM_DELTA_LINE wheel notch..."` case.
2. **`chat-window.tsx`'s `handleFilePick` cleared an already-valid `pickedFile` when a
   subsequent, oversized pick was rejected.** The paperclip button stays clickable while a
   file is staged, so a user could pick a valid photo, tap it again, and pick an oversized
   file by mistake -- the rejection branch called `setPickedFile(null)`, silently wiping
   the first, still-valid selection while showing only the "too large" error. Fixed by
   removing that clear (the rejection path now only sets the error, leaving whatever was
   already staged alone); new test `chat-window.test.tsx`'s `"keeps an already-valid
   picked file when a second, oversized pick is rejected"` case.

Both fixes were verified against the pre-fix code (the new tests fail without the fix,
confirmed by temporarily reverting each change) and pass after. Re-ran the full local
gate after both fixes: typecheck exit 0, lint exit 0, whole-suite test 176 passed / 8
failed (184 total, up from 174/182 -- the two new regression tests -- same 8 pre-existing
L37 failures, zero new failures).

### CI image build result

Built from fork `main` (post-merge of this plan's PR) via `gh workflow run
build-image.yml -f version=1.3.0`. `1.3.0` is a minor bump over the live `1.2.1` because
this batch adds features (panel avatars, panel photo attach), not just fixes; ByteTech's
image line is versioned independently of upstream's numbers and is never `:latest`
(D-25).

Full run id, GHCR verification (both the index digest and the `linux/amd64` platform-leg
digest), and rollback tag: `deploy/render.md`'s 2026-08-28/29 version-bump log entries
(shop-ops repo).

## Phase 07 Plan 08 — Anota-branded transactional email (INVITE-01)

Branch: `anota/branded-invitation-email`. Mail delivery went live in shop-ops plan 07-07
(Resend SMTP on Render), which made every email this instance sends user-visible for the
first time. Upstream's shared shell still carried a `Kaneo` badge and the four email-reachable locales' (de, fr, pt, vi)
`invitations.email` copy still said "Kaneo" — both missed by the 02.1-02 rebrand sweep
because `packages/email/` and the `invitations.email` block sat outside its grep scope
(shop-ops `docs/found-issues.md` L55). This plan replaces the shell with an Anota one and
finishes the string sweep.

### Fork-owned files (new, Anota-namespaced, no upstream counterpart)

| File | What it is |
|---|---|
| `packages/email/src/templates/anota-shell.tsx` | The email shell every template renders through, centered end to end (operator's calls 2026-09-02: centered over a left-aligned first cut, then a short band with the app's own lockup — mascot and wordmark side by side — over a stacked mascot/wordmark/host header): a `#141414` band 72 px tall carrying `${origin}/email-lockup-dark.png` (the `light` variant loads `email-lockup-light.png` on paper), a centered light body, and the instance host in a live-text colophon. Origin comes from `KANEO_CLIENT_URL` or the link being sent; with no origin the band falls back to a live-text wordmark. Centering uses `align="center"` on table cells plus `text-align` per text block — the only mechanisms every mail engine honours. Exports `styles` with the same keys upstream's shell exported (plus `subtitle`) and a `variant` (`band` default, `light`). `light` is the alternate header the operator was offered on 2026-09-02 and declined in favour of `band`; no live template passes `variant`, so it is unreachable in production and kept only as the ready-made alternate (one prop, plus `email-lockup-light.png`) — delete both if it stays unused. Achromatic per the approved brand kit; the lockup image carries styled alt text so a client that blocks remote images still shows "Anota" in the band's ink. |
| `apps/web/public/email-lockup-dark.png`, `email-lockup-light.png` | The app header lockup (`logo-light.svg` / `logo-dark.svg`) rasterised at 3× (354×96, shown at 118×32) on a SOLID `#141414` / `#ffffff` ground. Mail clients do not render SVG, and an alpha-edged tile rings against the band (the first cut used `apple-touch-icon.png` and did exactly that), so the PNG ground matches the cell it sits in. Regenerate from the SVGs if the lockup changes: render each SVG at 353.31×96 on its ground and screenshot a 354×96 viewport. |
| `packages/email/src/templates/anota-workspace-invitation.tsx` | The invitation email on that shell: title, the inviter's profile picture (new optional `inviterImage` prop — an absolute URL or Anota's `/api/user/avatar/<id>` path resolved against the instance origin; that route is public and cacheable) or an initials chip when they have none, the locale subtitle, one dark CTA, the accept URL in plain text, locale footer. Same props and `copy` contract as upstream's template plus that one prop; `DEFAULT_COPY` kept in sync with `i18n/en-US.json` by the existing test. |

### Upstream files edited directly, and why no override seam existed

| File | What changed | Why a direct edit (no seam) |
|---|---|---|
| `packages/email/src/templates/shell.tsx` | Body replaced by one line: `export { AnotaEmailShell as EmailShell, styles } from "./anota-shell";` | Five templates (`notification`, `trial-reminder`, `magic-link`, `otp`, `password-reset`) import `EmailShell`/`styles` from `./shell` — the invitation now imports `./anota-shell` directly — and upstream offers no shell injection point; re-exporting from the upstream path is the single edit that reaches all of them. On merge: keep the re-export, port any new `styles` key upstream adds into `anota-shell.tsx`. |
| `packages/email/src/templates/workspace-invitation.tsx` | Body replaced by a re-export of the Anota template's default export and its two types | `send-email.tsx`, `apps/api/src/auth.ts`, the locale helpers and `workspace-invitation.test.ts` all import from this path; the re-export keeps every consumer and the test unchanged. On merge: keep the re-export, port prop/copy additions into the Anota template. |
| `apps/api/src/auth.ts` | One line in the `sendInvitationEmail` hook: `inviterImage: data.inviter.user.image,` | better-auth hands the inviter's full user record to this hook and nothing else touches the template, so the picture only reaches the email if the call site passes it. On merge: keep the line; if upstream's template ever grows its own picture prop, map to that name. |
| `packages/email/src/templates/{notification,magic-link,password-reset,otp}.tsx` | Product-name strings `Kaneo` → `Anota` in the inlined en/de/vi copy (text only) | These templates inline their copy rather than reading i18n; same class of edit as the 02.1-02 string sweep. `trial-reminder.tsx` deliberately untouched — it is Kaneo-Cloud-only content that never sends on a self-hosted instance. |
| `i18n/{de-DE,fr-FR,pt-BR,vi-VN}.json` (`invitations.email` block only) | `Kaneo` → `Anota` in subject/preview/subtitle/footer | These four are exactly the locales `apps/api/src/utils/get-workspace-invitation-email-copy.ts` can serve (the email path resolves the USER's stored locale server-side, so `pt-BR` is reachable for this team even though no browser resolves to it). `en-US` and `es-ES` were already correct. The other eleven locale files keep the 02.1-02 ruling: unreachable here, so editing them is churn against D-25. Files re-serialised with the same tab indentation; diff is exactly the four lines per file. |

### Local gate output (pre-merge)

Recorded in the PR body and in shop-ops `07-08-SUMMARY.md`: `pnpm run build` (tsc) exit 0,
`pnpm test` (vitest) 3 files / 11 tests passed, `pnpm exec biome check src` clean.
Previews rendered with `@react-email/render` and screenshotted at 640 px and 375 px; the
operator chose the shipped variant from those. Second round the same day after the operator rejected the left-aligned layout: everything centered and the inviter's picture wired through; gates re-run — email `tsc` exit 0, vitest 3 files / 11 tests, biome clean, `apps/api` `tsc --noEmit` exit 0. Third round: header shortened to the side-by-side lockup on the solid-ground PNGs (same gates, same results). Fourth round (code-review fixes): `anota-workspace-invitation.test.ts` added for `resolveInviterImage` and `initialsOf`, `resolveOrigin` falls back on an empty origin, the picture's alt state carries the chip typography, initials are code-point safe — gates re-run: `tsc` exit 0, vitest 4 files / 20 tests, biome 17 files clean, `apps/api` `tsc --noEmit` exit 0.

### CI image build result

Deploy actions are recorded where they happen, not here: shop-ops `deploy/render.md`'s dated
rows are the log of record for the `build-image.yml` run (`-f version=1.3.3`, a patch bump over
the live `1.3.2` — templates, strings and two static assets, no migration, no schema change),
the GHCR digests and the Render cutover. This section describes the code on the branch; it
makes no claim about what has been built or deployed.
