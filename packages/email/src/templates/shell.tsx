// D-25 mount point (Anota fork): upstream's email shell is replaced by the
// Anota shell in ./anota-shell.tsx. Every template keeps importing from
// "./shell", so this file is the single upstream-side edit. On an upstream
// merge, keep this re-export and port any new `styles` keys into anota-shell.
export { AnotaEmailShell as EmailShell, styles } from "./anota-shell";
