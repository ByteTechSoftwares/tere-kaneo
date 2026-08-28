import { useTranslation } from "react-i18next";

export function KaneoBranding() {
  const { t } = useTranslation();

  // docs/found-issues.md:L40 (D-25) — the label already renders the
  // rebranded name ("Anota") via appName below; the anchor used to point
  // at the upstream vendor's own marketing site regardless. Dropped the
  // outbound link rather than repointing it at a Tere URL that doesn't
  // exist for this internal-only page — plain text is the simplest
  // component that can't misdirect a viewer of a public project page.
  return (
    <span className="hover:text-foreground transition-colors">
      {t("publicProject:branding.poweredBy")}{" "}
      <span className="font-medium">{t("common:appName")}</span>
    </span>
  );
}
