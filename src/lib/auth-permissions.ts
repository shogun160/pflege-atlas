export type Role = 'admin' | 'editor' | 'reviewer' | 'contributor';

export type Resource = 'articles' | 'submissions' | 'users' | 'media';

export type Action =
  // articles
  | 'read'
  | 'readAllStati'
  | 'createArticle'
  | 'updateContent'
  | 'transitionToReview'
  | 'transitionToReadyToPublish'
  | 'publish'
  | 'archive'
  | 'delete'
  | 'bulkImport'
  // submissions
  | 'createSubmission'
  | 'readAllSubmissions'
  | 'readOwnSubmissions'
  | 'updateSubmission'
  // users
  | 'readAllUsers'
  | 'inviteAdmin'
  | 'inviteEditor'
  | 'inviteReviewer'
  | 'inviteContributor'
  | 'updateOwnProfile'
  | 'updateOthersRole'
  | 'updateOthersDisabled'
  // media
  | 'readArticleImage'
  | 'readOwnAvatar'
  | 'readOthersAvatar'
  | 'uploadAvatar'
  | 'uploadArticleImage';

export interface UserPermissionInput {
  id: number;
  role: Role;
  disabled: boolean;
}

type PermissionSet = Set<Action>;

function s(...actions: Action[]): PermissionSet {
  return new Set(actions);
}

export const PERMISSIONS: Record<Role, PermissionSet> = {
  admin: s(
    'read', 'readAllStati', 'createArticle', 'updateContent',
    'transitionToReview', 'transitionToReadyToPublish', 'publish', 'archive', 'delete',
    'bulkImport',
    'createSubmission', 'readAllSubmissions', 'updateSubmission',
    'readAllUsers', 'inviteAdmin', 'inviteEditor', 'inviteReviewer', 'inviteContributor',
    'updateOwnProfile', 'updateOthersRole', 'updateOthersDisabled',
    'readArticleImage', 'readOwnAvatar', 'readOthersAvatar', 'uploadAvatar', 'uploadArticleImage',
  ),
  editor: s(
    'read', 'readAllStati', 'createArticle', 'updateContent',
    'transitionToReview', 'transitionToReadyToPublish', 'publish', 'archive',
    'bulkImport',
    'createSubmission', 'readAllSubmissions', 'updateSubmission',
    'readAllUsers', 'inviteReviewer', 'inviteContributor',
    'updateOwnProfile',
    'readArticleImage', 'readOwnAvatar', 'readOthersAvatar', 'uploadAvatar', 'uploadArticleImage',
  ),
  reviewer: s(
    'read', 'readAllStati', 'createArticle', 'updateContent',
    'transitionToReview', 'transitionToReadyToPublish',
    'createSubmission', 'readAllSubmissions', 'updateSubmission',
    'readAllUsers',
    'updateOwnProfile',
    'readArticleImage', 'readOwnAvatar', 'uploadAvatar', 'uploadArticleImage',
  ),
  contributor: s(
    'read',
    'createSubmission', 'readOwnSubmissions',
    'updateOwnProfile',
    'readArticleImage', 'readOwnAvatar', 'uploadAvatar',
  ),
};

export function hasPermission(
  user: UserPermissionInput | null,
  action: Action,
  resource: Resource,
): boolean {
  // Anonymous: only specific actions allowed
  if (!user) {
    return action === 'createSubmission' && resource === 'submissions';
  }
  // Disabled users have no permissions
  if (user.disabled) {
    return false;
  }
  return PERMISSIONS[user.role].has(action);
}

/**
 * Role-only permission check. Use this when you have just a role
 * (e.g. from req.user.role) and don't need user-instance specifics.
 * Equivalent to `hasPermission({ id: 0, role, disabled: false }, action, resource)`
 * but makes the intent explicit at the call-site.
 */
export function hasRolePermission(role: Role, action: Action, resource: Resource): boolean {
  // resource is part of the signature for forward-compat (mirrors hasPermission)
  // and to keep call-sites readable; current matrix is role/action-only.
  void resource;
  return PERMISSIONS[role].has(action);
}
