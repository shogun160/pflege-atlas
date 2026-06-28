import { describe, it, expect, vi, beforeEach } from 'vitest';
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

describe('BulkArticleImport', () => {
  let parseFilesAction: ReturnType<typeof vi.fn>;
  let runImportAction: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    parseFilesAction = vi.fn().mockResolvedValue([sampleRow]);
    runImportAction = vi.fn().mockResolvedValue([sampleResult]);
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
});
