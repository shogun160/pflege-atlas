import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BulkArticleImport } from '@/components/admin/BulkArticleImport';
import type { ImportRow, ImportResultRow } from '@/lib/article-import/types';

const sampleRow: ImportRow = {
  filename: 'a.md',
  sourceHash: 'abc',
  status: 'ready',
  title: 'Test',
  resolvedSlug: 'test',
  parseResult: {
    ok: true,
    article: {
      frontmatter: { title: 'Test', intent: 'bedside', summary: 'x' },
      sections: { definition: 'd', praxis: 'p', risiken: 'r', quellen: 'q' },
      warnings: [],
    },
  },
};

const sampleResult: ImportResultRow = {
  filename: 'a.md',
  ok: true,
  status: 'created',
  articleId: 42,
  adminUrl: '/admin/collections/articles/42',
};

type ParseFilesMock = Mock<(formData: FormData) => Promise<ImportRow[]>>;
type RunImportMock = Mock<(rows: ImportRow[]) => Promise<ImportResultRow[]>>;

describe('BulkArticleImport', () => {
  let parseFilesAction: ParseFilesMock;
  let runImportAction: RunImportMock;

  beforeEach(() => {
    parseFilesAction = vi.fn(async () => [sampleRow]) as ParseFilesMock;
    runImportAction = vi.fn(async () => [sampleResult]) as RunImportMock;
  });

  it('renders the idle state with drag-drop zone', () => {
    render(
      <BulkArticleImport parseFilesAction={parseFilesAction} runImportAction={runImportAction} />,
    );
    expect(screen.getByText(/dateien hier ablegen/i)).toBeInTheDocument();
  });

  it('transitions to preview after file selection', async () => {
    render(
      <BulkArticleImport parseFilesAction={parseFilesAction} runImportAction={runImportAction} />,
    );
    const file = new File(['---\ntitle: x\n---'], 'a.md', { type: 'text/markdown' });
    const input = screen.getByTestId('bulk-import-file-input');
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText('Test')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /import bestätigen/i })).not.toBeDisabled();
  });

  it('shows results table after confirming import', async () => {
    render(
      <BulkArticleImport parseFilesAction={parseFilesAction} runImportAction={runImportAction} />,
    );
    const file = new File(['---\ntitle: x\n---'], 'a.md', { type: 'text/markdown' });
    fireEvent.change(screen.getByTestId('bulk-import-file-input'), {
      target: { files: [file] },
    });
    await waitFor(() => screen.getByRole('button', { name: /import bestätigen/i }));
    fireEvent.click(screen.getByRole('button', { name: /import bestätigen/i }));
    await waitFor(() => expect(screen.getByText(/angelegt/i)).toBeInTheDocument());
    expect(runImportAction).toHaveBeenCalledTimes(1);
  });

  it('disables confirm button when no ready rows present', async () => {
    parseFilesAction.mockResolvedValueOnce([
      { ...sampleRow, status: 'invalid', parseResult: { ok: false, issues: [] } },
    ]);
    render(
      <BulkArticleImport parseFilesAction={parseFilesAction} runImportAction={runImportAction} />,
    );
    const file = new File(['x'], 'a.md', { type: 'text/markdown' });
    fireEvent.change(screen.getByTestId('bulk-import-file-input'), {
      target: { files: [file] },
    });
    await waitFor(() => screen.getByRole('button', { name: /import bestätigen/i }));
    expect(screen.getByRole('button', { name: /import bestätigen/i })).toBeDisabled();
  });

  it('disables Abbrechen during import to avoid stale-state race', async () => {
    // runImportAction never resolves so we stay in 'importing' phase
    const slowImport = vi.fn(() => new Promise<ImportResultRow[]>(() => {}));
    render(
      <BulkArticleImport parseFilesAction={parseFilesAction} runImportAction={slowImport} />,
    );
    const file = new File(['---\ntitle: x\n---'], 'a.md', { type: 'text/markdown' });
    fireEvent.change(screen.getByTestId('bulk-import-file-input'), {
      target: { files: [file] },
    });
    await waitFor(() => screen.getByRole('button', { name: /import bestätigen/i }));
    fireEvent.click(screen.getByRole('button', { name: /import bestätigen/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /importiere/i })).toBeInTheDocument(),
    );
    // While importing, the Abbrechen button should be disabled
    expect(screen.getByRole('button', { name: /abbrechen/i })).toBeDisabled();
  });
});
