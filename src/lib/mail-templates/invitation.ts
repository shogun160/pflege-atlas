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
