import { describe, expect, it } from "vitest";
import { getWorkspaceInvitationEmailCopy } from "../../../apps/api/src/utils/get-workspace-invitation-email-copy";

describe("getWorkspaceInvitationEmailCopy", () => {
  it("serves the Spanish copy for the bare es locale", () => {
    expect(getWorkspaceInvitationEmailCopy("es").subject).toBe(
      "{{inviterName}} te ha invitado a unirte a {{workspaceName}} en Anota",
    );
  });

  it("serves the Spanish copy for regional es-ES locales", () => {
    expect(getWorkspaceInvitationEmailCopy("es-ES").title).toBe(
      "Únete a {{workspaceName}}",
    );
  });

  it("serves the Spanish copy for regional es-MX locales", () => {
    expect(getWorkspaceInvitationEmailCopy("es-MX").footer).toBe(
      "Invitación a un espacio de trabajo de Anota",
    );
  });

  it("is case-insensitive for the es prefix", () => {
    expect(getWorkspaceInvitationEmailCopy("ES-es").subject).toBe(
      "{{inviterName}} te ha invitado a unirte a {{workspaceName}} en Anota",
    );
  });

  it("falls back to English for a genuinely unsupported locale", () => {
    expect(getWorkspaceInvitationEmailCopy("ja-JP").subject).toBe(
      "{{inviterName}} invited you to join {{workspaceName}} on Anota",
    );
  });

  it("falls back to English when no locale is given", () => {
    expect(getWorkspaceInvitationEmailCopy(undefined).subject).toBe(
      "{{inviterName}} invited you to join {{workspaceName}} on Anota",
    );
    expect(getWorkspaceInvitationEmailCopy(null).subject).toBe(
      "{{inviterName}} invited you to join {{workspaceName}} on Anota",
    );
  });
});
