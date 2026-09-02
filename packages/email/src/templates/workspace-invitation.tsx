// D-25 mount point (Anota fork): the workspace-invitation email is Anota's
// branded template in ./anota-workspace-invitation.tsx, which keeps upstream's
// props and copy contract. send-email.tsx, the API's locale helpers and the
// test file import from here unchanged. On an upstream merge, keep this
// re-export and port any prop/copy additions into the Anota template.
export {
  default,
  type WorkspaceInvitationEmailCopy,
  type WorkspaceInvitationEmailProps,
} from "./anota-workspace-invitation";
