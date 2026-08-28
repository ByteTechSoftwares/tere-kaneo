import { Link, Section, Text } from "@react-email/components";
import React from "react";
import { EmailShell, styles } from "./shell";

void React;

export type WorkspaceInvitationEmailProps = {
  workspaceName: string;
  inviterName: string;
  inviterEmail: string;
  invitationLink: string;
  to: string;
  copy?: WorkspaceInvitationEmailCopy;
};

export type WorkspaceInvitationEmailCopy = {
  subject: string;
  preview: string;
  title: string;
  subtitle: string;
  cta: string;
  sameEmail: string;
  ignore: string;
  footer: string;
};

// Inlined rather than imported from i18n/en-US.json: this package builds with
// tsc, so the import would survive into dist and resolve outside the published
// files at runtime.
//
// docs/found-issues.md:L55 — kept in sync with i18n/en-US.json's
// invitations.email block by hand (the workspace-invitation.test.ts "keeps
// the fallback in sync with the en-US bundle" case is the guard); missed by
// the 02.1-02 rebrand sweep because it lives outside that plan's
// apps/web/src, apps/web/index.html, i18n/ grep scope.
const DEFAULT_COPY: WorkspaceInvitationEmailCopy = {
  subject: "{{inviterName}} invited you to join {{workspaceName}} on Anota",
  preview: "You're invited to {{workspaceName}} on Anota",
  title: "Join {{workspaceName}}",
  subtitle:
    "{{inviterName}} ({{inviterEmail}}) invited you to collaborate in Anota.",
  cta: "Accept invitation",
  sameEmail: "You can accept with the same email that received this message.",
  ignore: "If this wasn't expected, you can safely ignore this email.",
  footer: "Anota workspace invitation",
};

function interpolate(template: string, values: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    return values[key] ?? "";
  });
}

const WorkspaceInvitationEmail = ({
  workspaceName,
  inviterName,
  inviterEmail,
  invitationLink,
  to,
  copy = DEFAULT_COPY,
}: WorkspaceInvitationEmailProps) => {
  const values = { workspaceName, inviterName, inviterEmail };

  return (
    <EmailShell
      preview={interpolate(copy.preview, values)}
      title={interpolate(copy.title, values)}
      subtitle={interpolate(copy.subtitle, values)}
    >
      <Section>
        <Link style={styles.button} href={`${invitationLink}?email=${to}`}>
          {copy.cta}
        </Link>
        <Text style={styles.paragraph}>{copy.sameEmail}</Text>
        <Text style={styles.muted}>{copy.ignore}</Text>
        <Section style={styles.divider} />
        <Text style={styles.footer}>{copy.footer}</Text>
      </Section>
    </EmailShell>
  );
};

WorkspaceInvitationEmail.PreviewProps = {
  workspaceName: "Acme Inc",
  inviterName: "John Doe",
  inviterEmail: "john@acme.com",
  invitationLink: "https://kaneo.app/invite/abc123",
  to: "invitee@example.com",
  copy: {
    subject: "{{inviterName}} invited you to join {{workspaceName}} on Anota",
    preview: "You're invited to {{workspaceName}} on Anota",
    title: "Join {{workspaceName}}",
    subtitle:
      "{{inviterName}} ({{inviterEmail}}) invited you to collaborate in Anota.",
    cta: "Accept invitation",
    sameEmail: "You can accept with the same email that received this message.",
    ignore: "If this wasn't expected, you can safely ignore this email.",
    footer: "Anota workspace invitation",
  },
} as WorkspaceInvitationEmailProps;

export default WorkspaceInvitationEmail;
