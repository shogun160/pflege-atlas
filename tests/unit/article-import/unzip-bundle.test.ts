import { describe, it, expect } from 'vitest';
import { unzipBundle, UnzipLimits } from '@/lib/article-import/unzip-bundle';

const limits: UnzipLimits = {
  maxEntries: 50,
  maxFileBytes: 256 * 1024,
  maxTotalBytes: 5 * 1024 * 1024,
};

// Helper: build an in-memory zip via streams. We use a tiny purpose-built
// builder rather than pulling in archiver — yauzl's "buffer" companion
// `yazl` is the canonical writer, install on demand.
async function makeZip(entries: Array<{ name: string; content: string }>): Promise<Buffer> {
  const yazl = (await import('yazl')).default ?? (await import('yazl'));
  const zip = new (yazl as { ZipFile: new () => unknown }).ZipFile() as {
    addBuffer: (buf: Buffer, name: string) => void;
    end: () => void;
    outputStream: NodeJS.ReadableStream;
  };
  for (const e of entries) {
    zip.addBuffer(Buffer.from(e.content, 'utf8'), e.name);
  }
  zip.end();
  const chunks: Buffer[] = [];
  for await (const chunk of zip.outputStream as AsyncIterable<Buffer>) chunks.push(chunk);
  return Buffer.concat(chunks);
}

// yazl v3 rejects path-traversal names at addBuffer time, so we craft a raw
// ZIP buffer manually to test our security check inside unzipBundle.
function makeMaliciousZip(filename: string, content: Buffer): Buffer {
  const fileData = content;
  const fnBuf = Buffer.from(filename, 'utf8');
  // Local file header
  const lfh = Buffer.alloc(30 + fnBuf.length + fileData.length);
  lfh.writeUInt32LE(0x04034b50, 0); // signature
  lfh.writeUInt16LE(20, 4);          // version needed
  lfh.writeUInt16LE(0, 6);           // flags
  lfh.writeUInt16LE(0, 8);           // compression (stored)
  lfh.writeUInt16LE(0, 10);          // mod time
  lfh.writeUInt16LE(0, 12);          // mod date
  lfh.writeUInt32LE(0, 14);          // crc-32 (0 for stored unverified)
  lfh.writeUInt32LE(fileData.length, 18); // compressed size
  lfh.writeUInt32LE(fileData.length, 22); // uncompressed size
  lfh.writeUInt16LE(fnBuf.length, 26);   // filename length
  lfh.writeUInt16LE(0, 28);              // extra field length
  fnBuf.copy(lfh, 30);
  fileData.copy(lfh, 30 + fnBuf.length);

  const cdOffset = lfh.length;
  // Central directory header
  const cdh = Buffer.alloc(46 + fnBuf.length);
  cdh.writeUInt32LE(0x02014b50, 0); // signature
  cdh.writeUInt16LE(20, 4);          // version made by
  cdh.writeUInt16LE(20, 6);          // version needed
  cdh.writeUInt16LE(0, 8);           // flags
  cdh.writeUInt16LE(0, 10);          // compression
  cdh.writeUInt16LE(0, 12);          // mod time
  cdh.writeUInt16LE(0, 14);          // mod date
  cdh.writeUInt32LE(0, 16);          // crc-32
  cdh.writeUInt32LE(fileData.length, 20); // compressed size
  cdh.writeUInt32LE(fileData.length, 24); // uncompressed size
  cdh.writeUInt16LE(fnBuf.length, 28);   // filename length
  cdh.writeUInt16LE(0, 30);              // extra field length
  cdh.writeUInt16LE(0, 32);              // file comment length
  cdh.writeUInt16LE(0, 34);              // disk number start
  cdh.writeUInt16LE(0, 36);              // internal attrs
  cdh.writeUInt32LE(0, 38);              // external attrs
  cdh.writeUInt32LE(0, 42);              // local header offset
  fnBuf.copy(cdh, 46);

  // End of central directory
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // signature
  eocd.writeUInt16LE(0, 4);           // disk number
  eocd.writeUInt16LE(0, 6);           // disk with CD
  eocd.writeUInt16LE(1, 8);           // entries on disk
  eocd.writeUInt16LE(1, 10);          // total entries
  eocd.writeUInt32LE(cdh.length, 12); // CD size
  eocd.writeUInt32LE(cdOffset, 16);   // CD offset
  eocd.writeUInt16LE(0, 20);          // comment length

  return Buffer.concat([lfh, cdh, eocd]);
}

describe('unzipBundle', () => {
  it('extracts .md files and returns content', async () => {
    const buf = await makeZip([
      { name: 'a.md', content: '# A' },
      { name: 'b.md', content: '# B' },
    ]);
    const result = await unzipBundle(buf, limits);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.files).toHaveLength(2);
    expect(result.files.map((f) => f.filename).sort()).toEqual(['a.md', 'b.md']);
  });

  it('rejects non-.md files (silent skip)', async () => {
    const buf = await makeZip([
      { name: 'a.md', content: '# A' },
      { name: 'b.txt', content: 'ignored' },
    ]);
    const result = await unzipBundle(buf, limits);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.files).toHaveLength(1);
  });

  it('rejects path traversal entries', async () => {
    // yazl v3 rejects ".." paths at build time, so we craft the ZIP manually
    const buf = makeMaliciousZip('../etc/passwd.md', Buffer.from('x'));
    const result = await unzipBundle(buf, limits);
    expect(result.ok).toBe(false);
  });

  it('rejects when entry count exceeds maxEntries', async () => {
    const entries = Array.from({ length: 51 }, (_, i) => ({
      name: `f${i}.md`,
      content: 'x',
    }));
    const buf = await makeZip(entries);
    const result = await unzipBundle(buf, limits);
    expect(result.ok).toBe(false);
  });

  it('rejects when a single file exceeds maxFileBytes', async () => {
    const tooBig = 'x'.repeat(limits.maxFileBytes + 1);
    const buf = await makeZip([{ name: 'big.md', content: tooBig }]);
    const result = await unzipBundle(buf, limits);
    expect(result.ok).toBe(false);
  });
});
