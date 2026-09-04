import { describe, expect, it } from "vitest";
import { getInvitationEmailSubject } from "../../../apps/api/src/utils/get-invitation-email-subject";

describe("getInvitationEmailSubject", () => {
  it("uses French copy for regional French locales", () => {
    const locale = "fr-FR";
    const inviterName = "Alice";
    const workspaceName = "Équipe produit";

    const subject = getInvitationEmailSubject(
      locale,
      inviterName,
      workspaceName,
    );

    expect(subject).toBe(
      "Alice vous invite à rejoindre Équipe produit sur Kaneo",
    );
  });

  it("keeps the German translation unchanged", () => {
    const locale = "de-DE";
    const inviterName = "Alice";
    const workspaceName = "Produkt";

    const subject = getInvitationEmailSubject(
      locale,
      inviterName,
      workspaceName,
    );

    expect(subject).toBe(
      "Alice hat dich eingeladen, Produkt auf Kaneo beizutreten",
    );
  });

  it("uses Brazilian Portuguese copy for regional Portuguese locales", () => {
    const locale = "pt-BR";
    const inviterName = "Alice";
    const workspaceName = "Equipe produto";

    const subject = getInvitationEmailSubject(
      locale,
      inviterName,
      workspaceName,
    );

    expect(subject).toBe(
      "Alice convidou você para participar de Equipe produto no Kaneo",
    );
  });

  it("uses Spanish copy for regional Spanish locales", () => {
    // docs/found-issues.md:L95 — es-ES used to fall through to the English
    // fallback here (get-workspace-invitation-email-copy only served
    // de/en/fr/pt/vi); es is now a supported prefix, so this fixture
    // resolves to the Spanish copy instead. See
    // tests/api/utils/get-workspace-invitation-email-copy.test.ts for
    // direct coverage of the locale-prefix matching itself.
    const locale = "es-ES";
    const inviterName = "Alice";
    const workspaceName = "Producto";

    const subject = getInvitationEmailSubject(
      locale,
      inviterName,
      workspaceName,
    );

    expect(subject).toBe("Alice te ha invitado a unirte a Producto en Anota");
  });

  it("uses the English fallback for genuinely unsupported locales", () => {
    const locale = "ja-JP";
    const inviterName = "Alice";
    const workspaceName = "Producto";

    const subject = getInvitationEmailSubject(
      locale,
      inviterName,
      workspaceName,
    );

    // docs/found-issues.md:L55 — en-US.json's invitations.email.subject was
    // rebranded to "Anota" (02.1-02). The fr-FR/de-DE/pt-BR cases above are
    // unaffected: those locales are deliberately unreachable in this
    // deployment's browser set (see docs/fork-notes.md's "Locale scope
    // decision") and their own JSON files were never rebranded, so they
    // still correctly expect "Kaneo".
    expect(subject).toBe("Alice invited you to join Producto on Anota");
  });
});
