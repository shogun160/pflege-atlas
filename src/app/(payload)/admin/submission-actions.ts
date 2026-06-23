'use server';

import 'server-only';
import { getPayloadClient } from '@/lib/payload';
import { getSession } from '@/lib/auth';
import { getOctokit } from '@/lib/github-app';
import { getGithubConfig } from '@/lib/env';
import { slugify } from '@/lib/slugify';
import { resolveUniqueSlug } from '@/lib/slug-resolver';
import { renderArticleMarkdown } from '@/lib/article-markdown';
import { applySubmissionToArticle } from '@/lib/submission-to-article';
import {
  createSubmissionPR,
  mergeSubmissionPR,
  closeSubmissionPR,
} from '@/lib/github-pr';

export type ActionResult = { ok: true } | { ok: false; error: string };

function repoCfg() {
  const cfg = getGithubConfig();
  return {
    owner: cfg?.owner ?? 'shogun160',
    repo: cfg?.repo ?? 'pflege-atlas',
  };
}

function buildPRBody(args: {
  submissionId: number;
  type: 'new_article' | 'correction';
  sections?: string[];
  proposedSlug?: string;
  correctionReason?: string;
}): string {
  const typeLabel = args.type === 'new_article' ? 'Neuer Artikelvorschlag' : 'Korrektur';
  const lines: string[] = [];
  lines.push(`**Typ:** ${typeLabel}`);
  if (args.type === 'correction' && args.sections?.length) {
    lines.push(`**Betroffene Sektionen:** ${args.sections.join(', ')}`);
  }
  if (args.type === 'new_article' && args.proposedSlug) {
    lines.push(`**Slug-Vorschlag:** \`${args.proposedSlug}\``);
  }
  lines.push(
    `**Admin-Link:** https://pflegeatlas.org/admin/collections/submissions/${args.submissionId}`,
  );
  if (args.correctionReason) {
    lines.push('', '**Begründung der/des Einreichenden:**');
    lines.push(...args.correctionReason.split('\n').map((l) => `> ${l}`));
  }
  lines.push('', '---', '');
  lines.push(
    '*Submitter-Daten (Name/E-Mail) bleiben in der Datenbank und werden nicht hier veröffentlicht.*',
  );
  return lines.join('\n');
}

export async function inReviewAction(submissionId: number): Promise<ActionResult> {
  const payload = await getPayloadClient();
  // The Submissions beforeChange hook gates auto-claim on `req.user?.id`.
  // Without forwarding the session here, the local-API call below runs as
  // anonymous and the hook silently leaves `currentReviewer` NULL (V1.7
  // smoke bug).
  const session = await getSession();
  const sub = await payload.findByID({ collection: 'submissions', id: submissionId, depth: 0 });
  if (!sub) return { ok: false, error: 'Submission not found' };

  const txn = await payload.db.beginTransaction();
  try {
    let slug = slugify((sub as { proposedSlug?: string }).proposedSlug ?? '');
    let articleSnapshot: Record<string, unknown> | null = null;
    const sections: string[] = [];

    if (sub.type === 'new_article') {
      if (!slug) {
        const base = slugify((sub as { proposedTitle?: string }).proposedTitle ?? '');
        slug = await resolveUniqueSlug(base, async (candidate) => {
          const res = await payload.find({
            collection: 'articles',
            where: { slug: { equals: candidate } },
            limit: 1,
            req: { transactionID: txn } as never,
          });
          return res.docs.length > 0;
        });
      }
      articleSnapshot = applySubmissionToArticle(sub as never, null).patch;
    } else {
      const relatedRaw = (sub as { relatedArticle?: number | { id: number } }).relatedArticle;
      const related = typeof relatedRaw === 'object' && relatedRaw !== null ? relatedRaw.id : relatedRaw;
      if (!related) return { ok: false, error: 'Correction submission missing relatedArticle' };
      const article = await payload.findByID({ collection: 'articles', id: related, depth: 0 });
      const apply = applySubmissionToArticle(sub as never, article as never);
      slug = apply.slug;
      articleSnapshot = { ...article, ...apply.patch };
      ['definition', 'praxis', 'risiken', 'quellen'].forEach((s) => {
        if (apply.patch[s] !== undefined) sections.push(s);
      });
    }

    const markdown = renderArticleMarkdown(
      { id: 0, slug, ...articleSnapshot, status: 'published' } as never,
      [],
    );
    const title =
      sub.type === 'new_article'
        ? `[Vorschlag] ${(sub as { proposedTitle?: string }).proposedTitle ?? slug}`
        : `[Korrektur] ${(articleSnapshot as { title?: string }).title ?? slug}`;
    const body = buildPRBody({
      submissionId,
      type: sub.type as 'new_article' | 'correction',
      sections,
      proposedSlug: sub.type === 'new_article' ? slug : undefined,
      correctionReason: (sub as { correctionReason?: string }).correctionReason,
    });

    const octokit = getOctokit();
    const { owner, repo } = repoCfg();
    const prResult = await createSubmissionPR(octokit, {
      owner,
      repo,
      submissionId,
      slug,
      markdown,
      title,
      body,
    });

    await payload.update({
      collection: 'submissions',
      id: submissionId,
      req: { transactionID: txn } as never,
      user: session ? ({ id: session.id, role: session.role } as never) : undefined,
      data: {
        reviewStatus: 'in_review',
        prNumber: prResult.prNumber,
        prBranch: prResult.prBranch,
        prState: prResult.prState === 'skipped' ? null : prResult.prState,
        proposedSlug: sub.type === 'new_article' ? slug : undefined,
      },
    });

    if (txn != null) await payload.db.commitTransaction(txn);
    return { ok: true };
  } catch (err) {
    if (txn != null) await payload.db.rollbackTransaction(txn);
    return { ok: false, error: (err as Error).message };
  }
}

export async function acceptAction(submissionId: number): Promise<ActionResult> {
  const payload = await getPayloadClient();
  const sub = await payload.findByID({ collection: 'submissions', id: submissionId, depth: 0 });
  if (!sub) return { ok: false, error: 'Submission not found' };

  const txn = await payload.db.beginTransaction();
  try {
    if (sub.type === 'new_article') {
      const apply = applySubmissionToArticle(sub as never, null);
      await payload.create({
        collection: 'articles',
        req: { transactionID: txn } as never,
        context: { skipMarkdownSync: true },
        data: {
          ...apply.patch,
          lastReviewedAt: new Date().toISOString(),
        } as never,
      });
    } else {
      const relatedRaw = (sub as { relatedArticle?: number | { id: number } }).relatedArticle;
      const related = typeof relatedRaw === 'object' && relatedRaw !== null ? relatedRaw.id : relatedRaw;
      if (!related) return { ok: false, error: 'Correction missing relatedArticle' };
      const article = await payload.findByID({ collection: 'articles', id: related, depth: 0, req: { transactionID: txn } as never });
      const apply = applySubmissionToArticle(sub as never, article as never);
      await payload.update({
        collection: 'articles',
        id: related,
        req: { transactionID: txn } as never,
        context: { skipMarkdownSync: true },
        data: { ...apply.patch, lastReviewedAt: new Date().toISOString() } as never,
      });
    }

    const octokit = getOctokit();
    const { owner, repo } = repoCfg();
    const prNumber = (sub as { prNumber?: number | null }).prNumber;
    const prBranch = (sub as { prBranch?: string | null }).prBranch;
    if (prNumber && prBranch) {
      await mergeSubmissionPR(octokit, { owner, repo, prNumber, branch: prBranch });
    }

    // KNOWN LIMITATION (V1.5 Plan-Gap, dokumentiert in HANDOFF-2026-06-20):
    // Wenn die folgende payload.update oder commitTransaction fehlschlägt,
    // bleibt der PR auf GitHub gemerged, aber die Submission ist noch im
    // reviewStatus=in_review-State. Retry des "Annehmen"-Klicks würde
    // mergeSubmissionPR nochmal aufrufen → GitHub 405 "not mergeable".
    // Mitigation für V1.5: Christoph erkennt den half-committed State im
    // Admin (Submission-Status != accepted, aber PR ist schon merged) und
    // kann manuell den Status nachsetzen. V1.6 sollte Compensating-Action
    // oder Submission-Update außerhalb der Transaction implementieren.
    await payload.update({
      collection: 'submissions',
      id: submissionId,
      req: { transactionID: txn } as never,
      data: { reviewStatus: 'accepted', prState: 'merged' },
    });

    if (txn != null) await payload.db.commitTransaction(txn);

    const email = (sub as { submitterEmail?: string }).submitterEmail;
    if (email) {
      await payload.sendEmail({
        to: email,
        subject: 'Dein Beitrag zu PflegeAtlas wurde übernommen',
        text:
          `Hallo,\n\n` +
          `dein Vorschlag wurde von der Redaktion geprüft und übernommen. ` +
          `Vielen Dank für deinen Beitrag!\n\n` +
          `Du findest den Artikel jetzt online auf pflegeatlas.org.\n\n` +
          `Liebe Grüße,\ndas PflegeAtlas-Team`,
      });
    }
    return { ok: true };
  } catch (err) {
    if (txn != null) await payload.db.rollbackTransaction(txn);
    return { ok: false, error: (err as Error).message };
  }
}

export async function rejectAction(submissionId: number): Promise<ActionResult> {
  const payload = await getPayloadClient();
  const sub = await payload.findByID({ collection: 'submissions', id: submissionId, depth: 0 });
  if (!sub) return { ok: false, error: 'Submission not found' };

  const txn = await payload.db.beginTransaction();
  try {
    const prNumber = (sub as { prNumber?: number | null }).prNumber;
    const prBranch = (sub as { prBranch?: string | null }).prBranch;
    if (prNumber && prBranch) {
      const octokit = getOctokit();
      const { owner, repo } = repoCfg();
      await closeSubmissionPR(octokit, { owner, repo, prNumber, branch: prBranch });
    }

    await payload.update({
      collection: 'submissions',
      id: submissionId,
      req: { transactionID: txn } as never,
      data: { reviewStatus: 'rejected', prState: prNumber ? 'closed' : null },
    });

    if (txn != null) await payload.db.commitTransaction(txn);
    return { ok: true };
  } catch (err) {
    if (txn != null) await payload.db.rollbackTransaction(txn);
    return { ok: false, error: (err as Error).message };
  }
}
