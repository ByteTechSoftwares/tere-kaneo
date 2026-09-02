import { Img, Link, Section, Text } from "@react-email/components";
import React from "react";
import {
  AnotaEmailShell,
  type AnotaEmailShellVariant,
  FONT_STACK,
  resolveOrigin,
  styles,
} from "./anota-shell";

void React;

// Anota's workspace-invitation email (D-25 fork file). Same props and copy
// contract as upstream's template plus `inviterImage` — the inviter's Anota
// profile picture — so `workspace-invitation.tsx` re-exports this and
// auth.ts, the locale helpers and the i18n bundles stay untouched.

export type WorkspaceInvitationEmailProps = {
  workspaceName: string;
  inviterName: string;
  inviterEmail: string;
  /**
   * The inviter's profile picture: an absolute URL, or the `/api/user/avatar/<id>`
   * path Anota stores for an uploaded avatar (resolved against the instance
   * the invitation link points at). Without one, the inviter's initials show.
   */
  inviterImage?: string | null;
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
export function initialsOf(name: string, email: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const fromName = words
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? "")
    .join("");
  const fromEmail = Array.from(email.trim())[0] ?? "";
  return (fromName || fromEmail).toUpperCase();
}

// Absolute http(s) URLs pass through; Anota's own `/api/user/avatar/<id>`
// paths resolve against the instance origin (the avatar route is public and
// cache-friendly, so mail clients can fetch it). Anything else — a data URL,
// a bare filename, no origin to resolve against — yields the initials chip.
export function resolveInviterImage(
  image: string | null | undefined,
  origin: string,
): string | null {
  if (!image) return null;
  if (/^https?:\/\//i.test(image)) return image;
  if (image.startsWith("/") && origin) return `${origin}${image}`;
  return null;
}

const AnotaWorkspaceInvitationEmail = ({
  workspaceName,
  inviterName,
  inviterEmail,
  inviterImage,
  invitationLink,
  to,
  copy = DEFAULT_COPY,
  variant,
}: WorkspaceInvitationEmailProps) => {
  const values = { workspaceName, inviterName, inviterEmail };
  const acceptHref = `${invitationLink}?email=${encodeURIComponent(to)}`;
  const origin = resolveOrigin(invitationLink);
  const initials = initialsOf(inviterName, inviterEmail);
  const avatarSrc = resolveInviterImage(inviterImage, origin);

  return (
    <AnotaEmailShell
      preview={interpolate(copy.preview, values)}
      title={interpolate(copy.title, values)}
      subtitle={
        <Section style={inviterBlock}>
          {avatarSrc ? (
            <Img
              src={avatarSrc}
              width="56"
              height="56"
              alt={initials}
              style={avatar}
            />
          ) : (
            <table
              role="presentation"
              align="center"
              border={0}
              cellPadding={0}
              cellSpacing={0}
              style={chipTable}
            >
              <tbody>
                <tr>
                  <td style={chipCell}>{initials}</td>
                </tr>
              </tbody>
            </table>
          )}
          <Text style={inviterText}>{interpolate(copy.subtitle, values)}</Text>
        </Section>
      }
      origin={origin}
      variant={variant}
    >
      <Section style={content}>
        <Text style={ctaRow}>
          <Link style={styles.button} href={acceptHref}>
            {copy.cta}
          </Link>
        </Text>
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

// Who is asking: the inviter's picture (or initials) centered above the
// locale subtitle. The chip is a one-cell table so its size and shape hold in
// every mail engine; the picture carries the initials as alt text for clients
// that block remote images.
const inviterBlock = {
  margin: "0 0 26px",
  textAlign: "center" as const,
};

// Carries the chip's typography too, so a client that blocks the picture
// shows the alt-text initials in the same styled circle.
const avatar = {
  display: "block",
  margin: "0 auto",
  borderRadius: "28px",
  border: "1px solid #e5e5e5",
  backgroundColor: "#f4f4f5",
  color: "#141414",
  fontFamily: FONT_STACK,
  fontSize: "17px",
  lineHeight: "56px",
  fontWeight: "600",
  letterSpacing: "0.04em",
  textAlign: "center" as const,
};

const chipTable = {
  margin: "0 auto",
};

const chipCell = {
  width: "56px",
  height: "56px",
  borderRadius: "28px",
  border: "1px solid #e5e5e5",
  backgroundColor: "#f4f4f5",
  color: "#141414",
  fontFamily: FONT_STACK,
  fontSize: "17px",
  lineHeight: "56px",
  fontWeight: "600",
  letterSpacing: "0.04em",
  textAlign: "center" as const,
  verticalAlign: "middle" as const,
};

const inviterText = {
  ...styles.subtitle,
  margin: "14px auto 0",
};

const content = {
  textAlign: "center" as const,
};

const ctaRow = {
  margin: "0",
  textAlign: "center" as const,
};

// The accept URL in plain text: survives image- and button-blocking clients,
// and lets a wary new hire read the domain before clicking anything.
const fallbackLink = {
  margin: "0 auto 12px",
  maxWidth: "440px",
  textAlign: "center" as const,
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
