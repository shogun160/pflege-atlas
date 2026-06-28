import 'server-only';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { hasRolePermission } from '@/lib/auth-permissions';

export async function BulkArticleImportNavLink() {
  const session = await getSession();
  if (!session || session.disabled) return null;
  if (!hasRolePermission(session.role, 'bulkImport', 'articles')) return null;
  return (
    <Link
      href="/admin/articles-import"
      style={{
        display: 'block',
        padding: '0.5rem 1rem',
        fontSize: '0.9rem',
      }}
    >
      📥 Artikel-Bulk-Import
    </Link>
  );
}
