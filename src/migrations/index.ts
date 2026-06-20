import * as migration_20260605_140707_init from './20260605_140707_init';
import * as migration_20260606_155824_v1_4_structured_submissions from './20260606_155824_v1_4_structured_submissions';
import * as migration_20260620_165037_v1_5_submissions_pr_fields from './20260620_165037_v1_5_submissions_pr_fields';

export const migrations = [
  {
    up: migration_20260605_140707_init.up,
    down: migration_20260605_140707_init.down,
    name: '20260605_140707_init'
  },
  {
    up: migration_20260606_155824_v1_4_structured_submissions.up,
    down: migration_20260606_155824_v1_4_structured_submissions.down,
    name: '20260606_155824_v1_4_structured_submissions'
  },
  {
    up: migration_20260620_165037_v1_5_submissions_pr_fields.up,
    down: migration_20260620_165037_v1_5_submissions_pr_fields.down,
    name: '20260620_165037_v1_5_submissions_pr_fields'
  },
];
