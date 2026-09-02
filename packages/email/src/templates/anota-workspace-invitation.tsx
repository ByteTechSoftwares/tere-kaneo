import { Column, Link, Row, Section, Text } from "@react-email/components";
import React from "react";
import {
  AnotaEmailShell,
  type AnotaEmailShellVariant,
  resolveOrigin,
  styles,
} from "./anota-shell";

void React;

// Anota's workspace-invitation email (D-25 fork file). Same props and copy
// contract as upstream's template — `workspace-invitation.tsx` re-exports
// this, so auth.ts, the locale helpers and the i18n bundles are untouched.

export type WorkspaceInvitationEmailProps = {
  workspaceName: string;
  inviterName: string;
  inviterEmail: string;
  invitationLink: string;
  to: string;
  copy?: WorkspaceInvitationEmailCopy;
  /** Shell treatment; the shell's default is the shipped one. */
  variant?: AnotaEmailShellVariant;
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
// files at runtime. workspace-invitation.test.ts keeps it in sync with the
// en-US bundle's invitations.email block.
export const DEFAULT_COPY: WorkspaceInvitationEmailCopy = {
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

// "Mario Silva" -> "MS"; falls back to the first letter of the email.
function initialsOf(name: string, email: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const fromName = words
    .slice(0, 2)
    .map((word) => word[0] ?? "")
    .join("");
  const fromEmail = email.trim()[0] ?? "";
  return (fromName || fromEmail).toUpperCase();
}

const AnotaWorkspaceInvitationEmail = ({
  workspaceName,
  inviterName,
  inviterEmail,
  invitationLink,
  to,
  copy = DEFAULT_COPY,
  variant,
}: WorkspaceInvitationEmailProps) => {
  const values = { workspaceName, inviterName, inviterEmail };
  const acceptHref = `${invitationLink}?email=${encodeURIComponent(to)}`;

  return (
    <AnotaEmailShell
      preview={interpolate(copy.preview, values)}
      title={interpolate(copy.title, values)}
      subtitle={
        <Row style={inviterRow}>
          <Column style={chipCell}>
            <Text style={chip}>{initialsOf(inviterName, inviterEmail)}</Text>
          </Column>
          <Column style={inviterCell}>
            <Text style={inviterText}>
              {interpolate(copy.subtitle, values)}
            </Text>
          </Column>
        </Row>
      }
      origin={resolveOrigin(invitationLink)}
      variant={variant}
    >
      <Section>
        <Link style={styles.button} href={acceptHref}>
          {copy.cta}
        </Link>
        <Text style={styles.paragraph}>{copy.sameEmail}</Text>
        <Text style={styles.muted}>{copy.ignore}</Text>
        <Section style={styles.divider} />
        <Text style={fallbackLink}>
          <Link href={acceptHref} style={fallbackAnchor}>
            {acceptHref}
          </Link>
        </Text>
        <Text style={styles.footer}>{copy.footer}</Text>
      </Section>
    </AnotaEmailShell>
  );
};

// Who is asking: an initials chip beside the locale subtitle, built from the
// inviter's name — live text, so it survives image-blocking clients.
const inviterRow = {
  margin: "0 0 22px",
};

const chipCell = {
  width: "36px",
  verticalAlign: "top" as const,
};

const chip = {
  display: "block",
  width: "36px",
  height: "36px",
  margin: "0",
  borderRadius: "18px",
  border: "1px solid #e5e5e5",
  backgroundColor: "#f4f4f5",
  color: "#141414",
  fontSize: "13px",
  lineHeight: "36px",
  fontWeight: "600",
  letterSpacing: "0.04em",
  textAlign: "center" as const,
};

const inviterCell = {
  paddingLeft: "12px",
  verticalAlign: "top" as const,
};

const inviterText = {
  ...styles.subtitle,
  margin: "6px 0 0",
};

// The accept URL in plain text: survives image- and button-blocking clients,
// and lets a wary new hire read the domain before clicking anything.
const fallbackLink = {
  margin: "0 0 12px",
  color: "#6b6b6b",
  fontSize: "12px",
  lineHeight: "18px",
  wordBreak: "break-all" as const,
};

const fallbackAnchor = {
  color: "#6b6b6b",
  textDecoration: "underline",
};

AnotaWorkspaceInvitationEmail.PreviewProps = {
  workspaceName: "Tere Auto Collision",
  inviterName: "Mario Silva",
  inviterEmail: "mario@tereautocollision.com",
  invitationLink:
    "https://anota.tereautocollision.com/invitation/accept/abc123",
  to: "invitee@example.com",
  copy: DEFAULT_COPY,
} as WorkspaceInvitationEmailProps;

export default AnotaWorkspaceInvitationEmail;
