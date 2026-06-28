import 'server-only';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { hasRolePermission } from '@/lib/auth-permissions';
import { BulkArticleImport } from './BulkArticleImport';
import { parseFilesAction, runImportAction } from './bulk-import-actions';

export async function BulkArticleImportServer() {
  const session = await getSession();
  if (!session || session.disabled) {
    redirect('/admin/login');
  }
  if (!hasRolePermission(session.role, 'bulkImport', 'articles')) {
    return (
      <div style={{ padding: '2rem' }}>
        <h1>Kein Zugriff</h1>
        <p>Bulk-Import ist nur für Editor:innen und Admins zugänglich.</p>
      </div>
    );
  }
  return (
    <BulkArticleImport
      parseFilesAction={parseFilesAction}
      runImportAction={runImportAction}
    />
  );
}
