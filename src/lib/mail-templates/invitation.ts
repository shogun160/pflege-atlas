// TODO(T9): Expand into a full invitation mail with proper layout, branding,
// expiry-hint, and role-context. Replace the inline HTML interpolation with
// a templating approach that HTML-escapes user-controlled fields
// (`displayName`, `invitedBy`). For T7 the inputs come from an admin form
// (admin trust boundary), but later surfaces — and copy-pasted derivatives
// for other mail types — must not assume that.
export function renderInvitationMail(args: {
  to: string;
  displayName: string;
  role: string;
  invitedBy: string;
  magicLink: string;
  expiresAt: Date;
}): { subject: string; html: string; text: string } {
  return {
    subject: `Willkommen bei PflegeAtlas`,
    html: `<p>Hallo ${args.displayName}, <a href="${args.magicLink}">aktiviere</a> deinen Account.</p>`,
    text: `Hallo ${args.displayName}, aktiviere: ${args.magicLink}`,
  };
}
