'use server';

import 'server-only';
import { getPayloadClient } from '@/lib/payload';
import { getSession } from '@/lib/auth';
import { hasRolePermission } from '@/lib/auth-permissions';
import { unzipBundle } from '@/lib/article-import/unzip-bundle';
import {
  parseFilesPure,
  runImportPure,
  MAX_FILES,
  MAX_FILE_BYTES,
  type RawFile,
} from './bulk-import-pure';
import type { ImportRow, ImportResultRow } from '@/lib/article-import/types';

// Re-export pure functions so tests and the UI wrapper can import from one path.
// These are NOT called as server actions from client components — the serialisable
// entry points below (parseFilesAction / runImportAction) are the public surface.
export { parseFilesPure, runImportPure, type RawFile };

const UNZIP_LIMITS = {
  maxEntries: MAX_FILES,
  maxFileBytes: MAX_FILE_BYTES,
  maxTotalBytes: 5 * 1024 * 1024,
};

async function assertPermission(): Promise<{ userId: number }> {
  const session = await getSession();
  if (!session) throw new Error('Nicht angemeldet.');
  if (session.disabled) throw new Error('Account ist deaktiviert.');
  if (!hasRolePermission(session.role, 'bulkImport', 'articles')) {
    throw new Error('Keine Berechtigung für Bulk-Import.');
  }
  return { userId: session.id };
}

async function readUploads(formData: FormData): Promise<RawFile[]> {
  const files: RawFile[] = [];
  const entries = formData.getAll('files');
  for (const entry of entries) {
    if (!(entry instanceof File)) continue;
    if (files.length >= MAX_FILES) {
      throw new Error(`Mehr als ${MAX_FILES} Dateien sind nicht erlaubt.`);
    }
    const buf = Buffer.from(await entry.arrayBuffer());
    if (entry.name.toLowerCase().endsWith('.zip')) {
      const result = await unzipBundle(buf, UNZIP_LIMITS);
      if (!result.ok) throw new Error(`ZIP "${entry.name}": ${result.error}`);
      for (const f of result.files) {
        if (files.length >= MAX_FILES) {
          throw new Error(`Mehr als ${MAX_FILES} Dateien (nach ZIP-Entpacken) sind nicht erlaubt.`);
        }
        files.push(f);
      }
      continue;
    }
    if (buf.byteLength > MAX_FILE_BYTES) {
      // Inject a synthetic invalid-row so the user sees it instead of an exception.
      files.push({ filename: entry.name, content: '__TOO_LARGE__' });
      continue;
    }
    files.push({ filename: entry.name, content: buf.toString('utf8') });
  }
  return files;
}

// --- Server actions (FormData entry points) -------------------------------

export async function parseFilesAction(formData: FormData): Promise<ImportRow[]> {
  await assertPermission();
  const payload = await getPayloadClient();
  const files = await readUploads(formData);
  return parseFilesPure(payload, files);
}

export async function runImportAction(rows: ImportRow[]): Promise<ImportResultRow[]> {
  const { userId } = await assertPermission();
  const payload = await getPayloadClient();
  return runImportPure(payload, userId, rows);
}
