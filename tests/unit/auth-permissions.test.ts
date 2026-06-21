import { describe, it, expect } from 'vitest';
import { hasPermission, hasRolePermission, PERMISSIONS, type Role } from '@/lib/auth-permissions';

describe('auth-permissions matrix', () => {
  it('admin can do everything on every collection', () => {
    const admin = { role: 'admin' as Role, id: 1, disabled: false };
    expect(hasPermission(admin, 'read', 'articles')).toBe(true);
    expect(hasPermission(admin, 'publish', 'articles')).toBe(true);
    expect(hasPermission(admin, 'delete', 'users')).toBe(true);
    expect(hasPermission(admin, 'inviteAdmin', 'users')).toBe(true);
  });

  it('editor cannot delete articles or invite admin', () => {
    const editor = { role: 'editor' as Role, id: 1, disabled: false };
    expect(hasPermission(editor, 'publish', 'articles')).toBe(true);
    expect(hasPermission(editor, 'delete', 'articles')).toBe(false);
    expect(hasPermission(editor, 'inviteAdmin', 'users')).toBe(false);
    expect(hasPermission(editor, 'inviteReviewer', 'users')).toBe(true);
  });

  it('reviewer cannot publish articles', () => {
    const reviewer = { role: 'reviewer' as Role, id: 1, disabled: false };
    expect(hasPermission(reviewer, 'updateContent', 'articles')).toBe(true);
    expect(hasPermission(reviewer, 'publish', 'articles')).toBe(false);
    expect(hasPermission(reviewer, 'inviteReviewer', 'users')).toBe(false);
  });

  it('contributor can only read own submissions and update own profile', () => {
    const contributor = { role: 'contributor' as Role, id: 1, disabled: false };
    expect(hasPermission(contributor, 'createSubmission', 'submissions')).toBe(true);
    expect(hasPermission(contributor, 'readAllSubmissions', 'submissions')).toBe(false);
    expect(hasPermission(contributor, 'updateOwnProfile', 'users')).toBe(true);
    expect(hasPermission(contributor, 'updateContent', 'articles')).toBe(false);
  });

  it('disabled user has no permissions', () => {
    const disabled = { role: 'admin' as Role, id: 1, disabled: true };
    expect(hasPermission(disabled, 'read', 'articles')).toBe(false);
  });

  it('null user has only anonymous permissions', () => {
    expect(hasPermission(null, 'read', 'articles')).toBe(false);
    expect(hasPermission(null, 'createSubmission', 'submissions')).toBe(true);
  });

  it('PERMISSIONS object contains all 4 roles', () => {
    expect(Object.keys(PERMISSIONS)).toEqual(['admin', 'editor', 'reviewer', 'contributor']);
  });

  it('hasRolePermission returns same as hasPermission for non-disabled users and ignores id', () => {
    // Matches positive case
    expect(hasRolePermission('editor', 'publish', 'articles')).toBe(
      hasPermission({ id: 42, role: 'editor', disabled: false }, 'publish', 'articles'),
    );
    // Matches negative case
    expect(hasRolePermission('reviewer', 'publish', 'articles')).toBe(
      hasPermission({ id: 99, role: 'reviewer', disabled: false }, 'publish', 'articles'),
    );
    // id is irrelevant — same role yields same result regardless of id
    expect(hasRolePermission('contributor', 'createSubmission', 'submissions')).toBe(true);
    expect(hasRolePermission('contributor', 'readAllSubmissions', 'submissions')).toBe(false);
  });
});
