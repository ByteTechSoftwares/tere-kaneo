import {
  Body,
  Column,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import React from "react";

void React;

// Anota's transactional-email shell (D-25 fork file). Every template renders
// through this: the dark note-card band carrying the mascot and wordmark, then
// the light body. `shell.tsx` re-exports it so upstream templates need no
// import changes. Identity is the approved achromatic kit
// (docs/brand-kit.md in tere-shop-ops): #141414 ground, #F5F5F5 ink, no hue.
//
// Images are optional by design — most clients hide remote images from a
// first-time sender, so the lockup keeps a live-text wordmark and the host
// line, and the layout reads correctly with images blocked.

export type AnotaEmailShellVariant = "band" | "light";

type AnotaEmailShellProps = {
  preview: string;
  title: string;
  /** A string gets the shell's subtitle style; a node is rendered as-is. */
  subtitle?: React.ReactNode;
  /**
   * Origin of the instance the email links into (e.g. https://anota.example).
   * Used for the hosted mark and the host line. Falls back to
   * KANEO_CLIENT_URL, then to a text-only lockup.
   */
  origin?: string;
  variant?: AnotaEmailShellVariant;
  children: React.ReactNode;
};

export const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const INK = "#141414";
const PAPER = "#ffffff";
const GROUND = "#f4f4f5";
const RULE = "#e5e5e5";

export function resolveOrigin(origin?: string): string {
  const candidate = origin ?? process.env.KANEO_CLIENT_URL ?? "";
  try {
    return candidate ? new URL(candidate).origin : "";
  } catch {
    return "";
  }
}

function hostOf(origin: string): string {
  try {
    return origin ? new URL(origin).host : "";
  } catch {
    return "";
  }
}

export function AnotaEmailShell({
  preview,
  title,
  subtitle,
  origin,
  variant = "band",
  children,
}: AnotaEmailShellProps) {
  const resolvedOrigin = resolveOrigin(origin);
  const host = hostOf(resolvedOrigin);
  const markSrc = resolvedOrigin
    ? `${resolvedOrigin}/apple-touch-icon.png`
    : null;
  const dark = variant === "band";

  return (
    <Html>
      <Head>
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={card}>
            <Row>
              <Column style={dark ? bandCell : lightHeaderCell}>
                <Row>
                  {markSrc ? (
                    <Column style={markCell}>
                      <Img
                        src={markSrc}
                        width="52"
                        height="52"
                        alt="Anota"
                        style={mark}
                      />
                    </Column>
                  ) : null}
                  <Column style={lockupCell}>
                    <Text style={dark ? wordmarkOnDark : wordmarkOnLight}>
                      Anota
                    </Text>
                    {host ? (
                      <Text style={dark ? hostOnDark : hostOnLight}>
                        {host}
                      </Text>
                    ) : null}
                  </Column>
                </Row>
              </Column>
            </Row>
            <Row>
              <Column style={bodyCell}>
                <Heading as="h1" style={heading}>
                  {title}
                </Heading>
                {typeof subtitle === "string" ? (
                  <Text style={subtitleText}>{subtitle}</Text>
                ) : (
                  (subtitle ?? null)
                )}
                <Section style={body}>{children}</Section>
              </Column>
            </Row>
          </Section>
          {host ? (
            <Section style={colophon}>
              <Text style={colophonText}>
                <Link href={resolvedOrigin} style={colophonLink}>
                  {host}
                </Link>
              </Text>
            </Section>
          ) : null}
        </Container>
      </Body>
    </Html>
  );
}

// Shared styles consumed by every template (same keys upstream's shell
// exported, so nothing else needs to change).
export const styles = {
  subtitle: {
    margin: "0 0 22px",
    color: "#525252",
    fontSize: "15px",
    lineHeight: "24px",
  },
  paragraph: {
    margin: "0 0 14px",
    color: "#404040",
    fontSize: "15px",
    lineHeight: "24px",
  },
  muted: {
    margin: "0",
    color: "#737373",
    fontSize: "13px",
    lineHeight: "20px",
  },
  button: {
    display: "inline-block",
    margin: "6px 0 22px",
    padding: "13px 26px",
    borderRadius: "10px",
    color: "#fafafa",
    backgroundColor: INK,
    textDecoration: "none",
    fontSize: "15px",
    fontWeight: "600",
    lineHeight: "20px",
    letterSpacing: "-0.01em",
  },
  code: {
    margin: "6px 0 18px",
    textAlign: "center" as const,
    padding: "16px 20px",
    borderRadius: "12px",
    border: `1px solid ${RULE}`,
    backgroundColor: GROUND,
    color: INK,
    fontSize: "30px",
    lineHeight: "36px",
    letterSpacing: "8px",
    fontWeight: "600",
  },
  divider: {
    borderTop: `1px solid ${RULE}`,
    margin: "22px 0 16px",
  },
  footer: {
    margin: "0",
    color: "#6b6b6b",
    fontSize: "12px",
    lineHeight: "18px",
  },
};

const main = {
  backgroundColor: GROUND,
  margin: "0",
  padding: "36px 12px 28px",
  fontFamily: FONT_STACK,
  WebkitFontSmoothing: "antialiased" as const,
};

const container = {
  margin: "0 auto",
  maxWidth: "560px",
};

const card = {
  width: "100%",
  backgroundColor: PAPER,
  borderRadius: "18px",
  border: `1px solid ${RULE}`,
  boxShadow: "0 10px 30px rgba(20, 20, 20, 0.07)",
  overflow: "hidden",
};

const bandCell = {
  backgroundColor: INK,
  borderRadius: "18px 18px 0 0",
  padding: "26px 32px",
};

const lightHeaderCell = {
  backgroundColor: PAPER,
  borderRadius: "18px 18px 0 0",
  borderBottom: `1px solid ${RULE}`,
  padding: "24px 32px 20px",
};

const markCell = {
  width: "52px",
  verticalAlign: "middle" as const,
};

const mark = {
  display: "block",
  borderRadius: "13px",
};

const lockupCell = {
  paddingLeft: "14px",
  verticalAlign: "middle" as const,
};

const wordmarkOnDark = {
  margin: "0",
  color: "#f5f5f5",
  fontSize: "22px",
  lineHeight: "26px",
  fontWeight: "700",
  letterSpacing: "-0.02em",
};

const wordmarkOnLight = {
  ...wordmarkOnDark,
  color: INK,
};

const hostOnDark = {
  margin: "3px 0 0",
  color: "#a3a3a3",
  fontSize: "12px",
  lineHeight: "16px",
  letterSpacing: "0.01em",
};

const hostOnLight = {
  ...hostOnDark,
  color: "#737373",
};

const bodyCell = {
  padding: "30px 32px 28px",
};

const heading = {
  margin: "0 0 10px",
  color: "#171717",
  fontSize: "26px",
  lineHeight: "32px",
  fontWeight: "600",
  letterSpacing: "-0.02em",
  fontFamily: FONT_STACK,
};

const subtitleText = styles.subtitle;

const body = {
  margin: "0",
};

const colophon = {
  padding: "18px 8px 0",
};

// #6b6b6b clears 4.5:1 on both the white card and the #f4f4f5 ground.
const colophonText = {
  margin: "0",
  textAlign: "center" as const,
  color: "#6b6b6b",
  fontSize: "12px",
  lineHeight: "18px",
};

const colophonLink = {
  color: "#6b6b6b",
  textDecoration: "none",
};
