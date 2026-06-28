import yauzl from 'yauzl';

export interface UnzipLimits {
  maxEntries: number;
  maxFileBytes: number;
  maxTotalBytes: number;
}

export interface ExtractedFile {
  filename: string; // basename only (no directory components)
  content: string; // utf-8 decoded
}

export type UnzipResult =
  | { ok: true; files: ExtractedFile[] }
  | { ok: false; error: string };

function isSafePath(name: string): boolean {
  // Defence in depth: yauzl's own validateFileName() (with decodeStrings: true,
  // the default) already rejects '..' segments and absolute paths before
  // emitting the 'entry' event. This function is kept as a redundant guard
  // in case decodeStrings ever changes or yauzl's behavior shifts. It also
  // makes the security intent explicit at the call-site.
  if (name.includes('..')) return false;
  if (name.startsWith('/') || name.match(/^[a-zA-Z]:[\\/]/)) return false;
  return true;
}

function isMarkdown(name: string): boolean {
  return /\.md$/i.test(name);
}

export async function unzipBundle(buffer: Buffer, limits: UnzipLimits): Promise<UnzipResult> {
  if (limits.maxEntries <= 0 || limits.maxFileBytes <= 0 || limits.maxTotalBytes <= 0) {
    return { ok: false, error: 'Ungültige Limits konfiguriert (positive Zahlen erwartet).' };
  }
  return new Promise((resolve) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zip) => {
      if (err || !zip) {
        resolve({ ok: false, error: `ZIP konnte nicht gelesen werden: ${err?.message ?? 'unbekannt'}` });
        return;
      }
      const files: ExtractedFile[] = [];
      let entryCount = 0;
      let totalBytes = 0;
      let aborted = false;

      const abort = (msg: string) => {
        if (aborted) return;
        aborted = true;
        zip.close();
        resolve({ ok: false, error: msg });
      };

      zip.on('entry', (entry) => {
        if (aborted) return;
        entryCount++;
        if (entryCount > limits.maxEntries) {
          abort(`ZIP enthält mehr als ${limits.maxEntries} Einträge.`);
          return;
        }
        if (!isSafePath(entry.fileName)) {
          abort(`Pfad-Traversal im ZIP entdeckt: "${entry.fileName}"`);
          return;
        }
        // Directory entry or non-md file → skip silently
        if (entry.fileName.endsWith('/') || !isMarkdown(entry.fileName)) {
          zip.readEntry();
          return;
        }
        if (entry.uncompressedSize > limits.maxFileBytes) {
          abort(`Datei "${entry.fileName}" überschreitet das Limit von ${limits.maxFileBytes} Bytes.`);
          return;
        }
        totalBytes += entry.uncompressedSize;
        if (totalBytes > limits.maxTotalBytes) {
          abort(`ZIP-Gesamtgröße überschreitet ${limits.maxTotalBytes} Bytes.`);
          return;
        }
        zip.openReadStream(entry, (rsErr, stream) => {
          if (rsErr || !stream) {
            abort(`Konnte Eintrag "${entry.fileName}" nicht lesen.`);
            return;
          }
          const chunks: Buffer[] = [];
          stream.on('data', (c: Buffer) => chunks.push(c));
          stream.on('end', () => {
            const basename = entry.fileName.split('/').pop()!;
            files.push({ filename: basename, content: Buffer.concat(chunks).toString('utf8') });
            zip.readEntry();
          });
          stream.on('error', (e: Error) => abort(`Lesefehler in "${entry.fileName}": ${e.message}`));
        });
      });
      zip.on('end', () => {
        if (!aborted) resolve({ ok: true, files });
      });
      zip.on('error', (e) => abort(`ZIP-Lesefehler: ${e.message}`));
      zip.readEntry();
    });
  });
}
