import { diffLines } from 'diff';

export type DiffPart = { kind: 'equal' | 'add' | 'remove'; text: string };
export type DiffResult = { changed: boolean; parts: DiffPart[] };

export function diffSection(original: string, edited: string): DiffResult {
  const parts = diffLines(original, edited).map<DiffPart>((change) => {
    if (change.added) return { kind: 'add', text: change.value };
    if (change.removed) return { kind: 'remove', text: change.value };
    return { kind: 'equal', text: change.value };
  });
  const changed = parts.some((p) => p.kind !== 'equal');
  return { changed, parts };
}
