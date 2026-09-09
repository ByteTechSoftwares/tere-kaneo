// anota-phone-cell.tsx
//
// Phase 10, ONBOARD-10 (D-05..D-09): the Members-page phone-number cell
// and its edit dialog. This is the ONLY Anota-namespaced file backing the
// one-mount-point insertion in ../components/team/members-table.tsx
// (fork-discipline D-25 of Phase 2) — every behaviour described in
// 10-UI-SPEC.md lives here, not in the upstream file.
//
// Data loading is shared across the whole table via AnotaPhoneProvider:
// one GET {VITE_ANOTA_PANEL_URL}/members per table render, never one per
// row. AnotaPhoneCell reads from that context; if it is unwrapped it
// renders nothing rather than throwing (an unauthenticated/unwrapped
// table is not this component's problem).
//
// Visibility (D-09) is driven by whether the fetched `members` list even
// contains this row's userId: the read route (10-03) returns every
// member for an admin viewer and exactly the caller's own entry for
// everyone else, so "not in the map" already means "not allowed to see
// this row" — no separate role check is needed on the client.
import { PencilIcon } from "lucide-react";
import {
  createContext,
  type FormEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toast";
import { useAnotaSession } from "./use-anota-session";

// Build-time Vite constant — already ends at the `/panel` segment (a
// documented prior footgun: use-anota-transcript.ts:31-45). This file
// appends its own `/members` and `/members/phone` sub-paths and never
// re-includes `/panel`.
// Read lazily (not as a module-level const) so vitest's per-test
// `vi.stubEnv` works without `vi.resetModules()` — same convention as
// `@/fetchers/get-api-url` / `resolve-avatar-src.ts`.
function getPanelBaseUrl(): string | undefined {
  return import.meta.env.VITE_ANOTA_PANEL_URL as string | undefined;
}

// ---------------------------------------------------------------------
// E.164 normalisation (client-side only, deliberately NOT shared with
// worker/scripts/sync-allowlist.mjs's own copy — 10-RESEARCH.md's
// "Reusable Assets" section is explicit that the two stay independent).
// Mirrors that script's toE164 exactly: accept a `+`-prefixed value
// as-is, otherwise strip non-digits and accept a 10-digit number (assume
// US) or an 11-digit number already carrying a leading 1.
// ---------------------------------------------------------------------
function toE164(rawNumber: string): string | null {
  const trimmed = rawNumber.trim();
  if (trimmed.startsWith("+")) {
    // Strip everything but digits after the leading `+` — the field's own
    // placeholder ("+1 954 555 0100") suggests a spaced format, so a
    // user typing exactly that must still normalize to valid E.164
    // (no spaces) rather than round-tripping the raw spaced string.
    const digits = trimmed.slice(1).replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 15 ? `+${digits}` : null;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

// Display format fixed by 10-UI-SPEC.md: 4 bullets, one space, last 4
// digits, constant width regardless of country code.
function maskLast4(e164: string): string {
  return `•••• ${e164.slice(-4)}`;
}

// ---------------------------------------------------------------------
// Shared per-table data: one GET, shared via context.
// ---------------------------------------------------------------------

interface AnotaPhoneContextValue {
  readonly byUserId: Map<string, string | null>;
  readonly viewerCanEdit: boolean;
  readonly viewerUserId: string | null;
  readonly refresh: () => Promise<void>;
  readonly state: "loading" | "ready" | "error";
}

const AnotaPhoneContext = createContext<AnotaPhoneContextValue | null>(null);

interface MembersReadResponse {
  readonly viewer: {
    readonly kaneoUserId: string;
    readonly workspaceRole: string;
    readonly canEdit: boolean;
  };
  readonly members: ReadonlyArray<{
    readonly kaneoUserId: string;
    readonly phone: string | null;
  }>;
}

export function AnotaPhoneProvider({ children }: { children: ReactNode }) {
  const { getBearerToken } = useAnotaSession();
  const [byUserId, setByUserId] = useState<Map<string, string | null>>(
    () => new Map(),
  );
  const [viewerCanEdit, setViewerCanEdit] = useState(false);
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(async () => {
    const panelBaseUrl = getPanelBaseUrl();
    if (!panelBaseUrl) {
      setState("error");
      return;
    }
    setState("loading");
    try {
      const token = await getBearerToken();
      if (!token) {
        setState("error");
        return;
      }
      const response = await fetch(`${panelBaseUrl}/members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        setState("error");
        return;
      }
      const body = (await response.json()) as MembersReadResponse;
      const next = new Map<string, string | null>();
      for (const member of body.members) {
        next.set(member.kaneoUserId, member.phone);
      }
      setByUserId(next);
      setViewerCanEdit(body.viewer.canEdit);
      setViewerUserId(body.viewer.kaneoUserId);
      setState("ready");
    } catch {
      setState("error");
    }
  }, [getBearerToken]);

  useEffect(() => {
    load();
  }, [load]);

  const value = useMemo<AnotaPhoneContextValue>(
    () => ({ byUserId, viewerCanEdit, viewerUserId, refresh: load, state }),
    [byUserId, viewerCanEdit, viewerUserId, load, state],
  );

  return (
    <AnotaPhoneContext.Provider value={value}>
      {children}
    </AnotaPhoneContext.Provider>
  );
}

// ---------------------------------------------------------------------
// The cell
// ---------------------------------------------------------------------

export interface AnotaPhoneCellProps {
  readonly userId: string;
  readonly isSelf: boolean;
  readonly canEdit: boolean;
  // Not in the plan's original 3-prop mount-point description: the
  // read wire contract (shared verbatim with plan 10-03) carries no
  // name field, so the UI-SPEC's {{name}} interpolation (aria-label,
  // dialog description, clear-confirmation copy) has nowhere else to
  // come from. members-table.tsx already computes member.user.name at
  // the row, so this is a zero-fetch, zero-architecture addition — see
  // 10-01-SUMMARY.md "Deviations".
  readonly name: string;
}

type SaveErrorKind = "claimed" | null;

export function AnotaPhoneCell({
  userId,
  isSelf,
  canEdit,
  name,
}: AnotaPhoneCellProps) {
  const { t } = useTranslation();
  const { getBearerToken } = useAnotaSession();
  const ctx = useContext(AnotaPhoneContext);
  const inputId = useId();
  const consentId = useId();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const [saveError, setSaveError] = useState<SaveErrorKind>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const hasEntry = ctx?.byUserId.has(userId) ?? false;
  const phone = ctx?.byUserId.get(userId) ?? null;

  const openDialog = useCallback(() => {
    setInputValue(phone ?? "");
    setConsentChecked(false);
    setConsentError(false);
    setSaveError(null);
    setIsDialogOpen(true);
  }, [phone]);

  const putPhone = useCallback(
    async (nextPhone: string | null) => {
      const token = await getBearerToken();
      if (!token) return { ok: false, status: 0 } as const;
      const response = await fetch(`${getPanelBaseUrl()}/members/phone`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ kaneoUserId: userId, phone: nextPhone }),
      });
      return response;
    },
    [getBearerToken, userId],
  );

  const canSave = consentChecked && toE164(inputValue) !== null;

  const handleSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (!consentChecked) {
        setConsentError(true);
        return;
      }
      const normalized = toE164(inputValue);
      if (!normalized) return;
      setConsentError(false);
      setSaveError(null);
      setIsSaving(true);
      try {
        if (!getPanelBaseUrl()) {
          toast.error(
            t("team:membersTable.phone.errorNetwork", {
              defaultValue:
                "Couldn't save — check your connection and try again.",
            }),
          );
          return;
        }
        const response = await putPhone(normalized);
        if (response.status === 409) {
          setSaveError("claimed");
          return;
        }
        if (response.status === 403) {
          toast.error(
            t("team:membersTable.phone.errorForbidden", {
              defaultValue: "You don't have permission to edit phone numbers.",
            }),
          );
          return;
        }
        if (!response.ok) {
          toast.error(
            t("team:membersTable.phone.errorNetwork", {
              defaultValue:
                "Couldn't save — check your connection and try again.",
            }),
          );
          return;
        }
        toast.success(
          t("team:membersTable.phone.saveSuccessToast", {
            defaultValue: "Phone number saved",
          }),
        );
        setIsDialogOpen(false);
        await ctx?.refresh();
      } catch {
        toast.error(
          t("team:membersTable.phone.errorNetwork", {
            defaultValue:
              "Couldn't save — check your connection and try again.",
          }),
        );
      } finally {
        setIsSaving(false);
      }
    },
    [consentChecked, inputValue, putPhone, t, ctx],
  );

  const handleClear = useCallback(async () => {
    setIsClearing(true);
    try {
      if (!getPanelBaseUrl()) {
        toast.error(
          t("team:membersTable.phone.errorNetwork", {
            defaultValue:
              "Couldn't save — check your connection and try again.",
          }),
        );
        return;
      }
      const response = await putPhone(null);
      if (response.status === 403) {
        toast.error(
          t("team:membersTable.phone.errorForbidden", {
            defaultValue: "You don't have permission to edit phone numbers.",
          }),
        );
        return;
      }
      if (!response.ok) {
        toast.error(
          t("team:membersTable.phone.errorNetwork", {
            defaultValue:
              "Couldn't save — check your connection and try again.",
          }),
        );
        return;
      }
      toast.success(
        t("team:membersTable.phone.clearSuccessToast", {
          defaultValue: "Phone number cleared",
        }),
      );
      setIsClearConfirmOpen(false);
      setIsDialogOpen(false);
      await ctx?.refresh();
    } catch {
      toast.error(
        t("team:membersTable.phone.errorNetwork", {
          defaultValue: "Couldn't save — check your connection and try again.",
        }),
      );
    } finally {
      setIsClearing(false);
    }
  }, [putPhone, t, ctx]);

  // No provider above this cell (unwrapped render): nothing to show
  // rather than throwing.
  if (!ctx) return null;

  // The viewer's own GET only ever returns their own entry (D-09) — a
  // row missing from the map means this viewer may not see it at all.
  if (!hasEntry) return null;

  if (!canEdit) {
    if (isSelf && phone) {
      return (
        <span className="text-sm text-muted-foreground tabular-nums">
          {maskLast4(phone)}
        </span>
      );
    }
    return null;
  }

  return (
    <>
      {phone ? (
        <div className="flex items-center gap-1">
          <span className="text-sm text-muted-foreground tabular-nums">
            {maskLast4(phone)}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            aria-label={t("team:membersTable.phone.ariaEdit", {
              defaultValue: "Edit phone number for {{name}}",
              name,
            })}
            onClick={openDialog}
          >
            <PencilIcon className="size-4" />
          </Button>
        </div>
      ) : (
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 font-normal"
          onClick={openDialog}
        >
          {t("team:membersTable.phone.addNumber", {
            defaultValue: "Add number",
          })}
        </Button>
      )}

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => setIsDialogOpen(open)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {phone
                ? t("team:membersTable.phone.editTitle", {
                    defaultValue: "Edit phone number",
                  })
                : t("team:membersTable.phone.addTitle", {
                    defaultValue: "Add phone number",
                  })}
            </DialogTitle>
            <DialogDescription>
              {t("team:membersTable.phone.description", {
                defaultValue: "This number receives Anota texts for {{name}}.",
                name,
              })}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-4 px-6 py-5"
          >
            {!phone ? (
              <div className="flex flex-col gap-1 rounded-lg border border-dashed border-border p-4 text-center">
                <p className="text-sm font-medium text-foreground">
                  {t("team:membersTable.phone.emptyStateHeading", {
                    defaultValue: "No number on file",
                  })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("team:membersTable.phone.emptyStateBody", {
                    defaultValue:
                      "Add this person's number once their consent form is signed.",
                  })}
                </p>
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <Label htmlFor={inputId}>
                {t("team:membersTable.phone.fieldLabel", {
                  defaultValue: "Phone number",
                })}
              </Label>
              <Input
                id={inputId}
                autoFocus
                value={inputValue}
                onChange={(event) => {
                  setInputValue(event.target.value);
                  setSaveError(null);
                }}
                placeholder={t("team:membersTable.phone.fieldPlaceholder", {
                  defaultValue: "+1 954 555 0100",
                })}
              />
              <p className="text-xs text-muted-foreground">
                {t("team:membersTable.phone.fieldHelper", {
                  defaultValue:
                    "Enter the number they text and receive Anota messages on.",
                })}
              </p>
              {saveError === "claimed" ? (
                <p className="text-xs text-destructive">
                  {t("team:membersTable.phone.errorClaimed", {
                    defaultValue:
                      "That number is already assigned to another team member. Confirm the number and try again.",
                  })}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id={consentId}
                  checked={consentChecked}
                  onCheckedChange={(value) => {
                    setConsentChecked(Boolean(value));
                    setConsentError(false);
                  }}
                />
                <Label htmlFor={consentId} className="text-sm font-medium">
                  {t("team:membersTable.phone.consentLabel", {
                    defaultValue: "Signed SMS consent form on file",
                  })}
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("team:membersTable.phone.consentHelper", {
                  defaultValue: "Required before this number can go live.",
                })}
              </p>
              {consentError ? (
                <p className="text-xs text-muted-foreground">
                  {t("team:membersTable.phone.errorConsentRequired", {
                    defaultValue: "Check the consent box to save this number.",
                  })}
                </p>
              ) : null}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isSaving}
              >
                {t("common:actions.cancel")}
              </Button>
              {phone ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsClearConfirmOpen(true)}
                  disabled={isSaving}
                >
                  {t("team:membersTable.phone.clearNumber", {
                    defaultValue: "Clear number",
                  })}
                </Button>
              ) : null}
              <Button
                type="submit"
                disabled={!canSave || isSaving}
                loading={isSaving}
              >
                {t("team:membersTable.phone.saveNumber", {
                  defaultValue: "Save number",
                })}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={isClearConfirmOpen}
        onOpenChange={setIsClearConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("team:membersTable.phone.clearConfirmTitle", {
                defaultValue: "Clear phone number?",
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("team:membersTable.phone.clearConfirmDescription", {
                defaultValue:
                  "{{name}} will stop receiving texts from Anota until a number is added again.",
                name,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose
              render={
                <Button variant="outline" size="sm" disabled={isClearing} />
              }
            >
              {t("common:actions.cancel")}
            </AlertDialogClose>
            <AlertDialogClose
              render={
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={isClearing}
                  onClick={handleClear}
                />
              }
            >
              {t("team:membersTable.phone.clearNumber", {
                defaultValue: "Clear number",
              })}
            </AlertDialogClose>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default AnotaPhoneCell;
