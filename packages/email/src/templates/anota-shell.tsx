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
// through this: a short centered dark band carrying the app's own lockup
// (mascot and wordmark side by side), then a centered light body. `shell.tsx`
// re-exports it so upstream templates need no import changes. Identity is the
// approved achromatic kit (docs/brand-kit.md in tere-shop-ops): #141414
// ground, #F5F5F5 ink, no hue. Everything is centered — the operator's call
// (2026-09-02) over the left-aligned first cut.
//
// Images are optional by design — some clients hide remote images from a
// first-time sender, so the lockup image carries styled alt text (a white
// "Anota" on the band) and the host stays in live text in the colophon. Centering is done
// with `align="center"` on table cells (the one mechanism every mail engine
// honours) plus `text-align` on each text block, never on the body alone.

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
  const candidate = origin || process.env.KANEO_CLIENT_URL || "";
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
  const dark = variant === "band";
  // The app's own header lockup (mascot + wordmark, apps/web/public/
  // logo-{light,dark}.svg) rasterised on a solid band/paper ground so it sits
  // flush — mail clients do not render SVG, and an alpha edge rings on dark.
  const lockupSrc = resolvedOrigin
    ? `${resolvedOrigin}/email-lockup-${dark ? "dark" : "light"}.png`
    : null;

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
              <Column align="center" style={dark ? bandCell : lightHeaderCell}>
                {lockupSrc ? (
                  <Img
                    src={lockupSrc}
                    width="118"
                    height="32"
                    alt="Anota"
                    style={dark ? lockupOnDark : lockupOnLight}
                  />
                ) : (
                  <Text style={dark ? wordmarkOnDark : wordmarkOnLight}>
                    Anota
                  </Text>
                )}
              </Column>
            </Row>
            <Row>
              <Column align="center" style={bodyCell}>
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
// exported, so nothing else needs to change). All text blocks are centered.
export const styles = {
  subtitle: {
    margin: "0 auto 24px",
    maxWidth: "420px",
    textAlign: "center" as const,
    color: "#525252",
    fontSize: "15px",
    lineHeight: "24px",
  },
  paragraph: {
    margin: "0 auto 14px",
    maxWidth: "420px",
    textAlign: "center" as const,
    color: "#404040",
    fontSize: "15px",
    lineHeight: "24px",
  },
  muted: {
    margin: "0 auto",
    maxWidth: "420px",
    textAlign: "center" as const,
    color: "#737373",
    fontSize: "13px",
    lineHeight: "20px",
  },
  button: {
    display: "inline-block",
    margin: "4px 0 24px",
    padding: "14px 30px",
    borderRadius: "10px",
    color: "#fafafa",
    backgroundColor: INK,
    textDecoration: "none",
    fontSize: "15px",
    fontWeight: "600",
    lineHeight: "20px",
    letterSpacing: "-0.01em",
    textAlign: "center" as const,
  },
  code: {
    margin: "6px auto 18px",
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
    margin: "24px 0 16px",
  },
  footer: {
    margin: "0",
    textAlign: "center" as const,
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
  padding: "20px 32px",
  textAlign: "center" as const,
};

const lightHeaderCell = {
  backgroundColor: PAPER,
  borderRadius: "18px 18px 0 0",
  borderBottom: `1px solid ${RULE}`,
  padding: "20px 32px",
  textAlign: "center" as const,
};

// Styled alt text: when the image is blocked, "Anota" renders in the band's
// ink at wordmark weight instead of an empty box.
const lockupOnDark = {
  display: "block",
  margin: "0 auto",
  color: "#f5f5f5",
  fontSize: "20px",
  lineHeight: "32px",
  fontWeight: "700",
  letterSpacing: "-0.02em",
  textAlign: "center" as const,
};

const lockupOnLight = {
  ...lockupOnDark,
  color: INK,
};

// Text-only lockup for the no-origin case (no instance URL to load from).
const wordmarkOnDark = {
  margin: "0",
  textAlign: "center" as const,
  color: "#f5f5f5",
  fontSize: "22px",
  lineHeight: "32px",
  fontWeight: "700",
  letterSpacing: "-0.02em",
};

const wordmarkOnLight = {
  ...wordmarkOnDark,
  color: INK,
};

const bodyCell = {
  padding: "34px 36px 30px",
  textAlign: "center" as const,
};

const heading = {
  margin: "0 0 10px",
  textAlign: "center" as const,
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
  textAlign: "center" as const,
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
