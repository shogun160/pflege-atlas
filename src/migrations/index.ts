import * as migration_20260605_140707_init from './20260605_140707_init';
import * as migration_20260606_155824_v1_4_structured_submissions from './20260606_155824_v1_4_structured_submissions';
import * as migration_20260620_165037_v1_5_submissions_pr_fields from './20260620_165037_v1_5_submissions_pr_fields';
import * as migration_20260621_120000_drop_versions_and_status from './20260621_120000_drop_versions_and_status';
import * as migration_20260621_140000_articles_status_enum_extend from './20260621_140000_articles_status_enum_extend';
import * as migration_20260622_100000_users_role_articles_status_enums from './20260622_100000_users_role_articles_status_enums';
import * as migration_20260622_100100_users_lifecycle_and_profile_fields from './20260622_100100_users_lifecycle_and_profile_fields';
import * as migration_20260622_100200_submissions_articles_media_review_fields from './20260622_100200_submissions_articles_media_review_fields';
import * as migration_20260622_100300_submissions_media_review_fields_repair from './20260622_100300_submissions_media_review_fields_repair';

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
  {
    up: migration_20260621_120000_drop_versions_and_status.up,
    down: migration_20260621_120000_drop_versions_and_status.down,
    name: '20260621_120000_drop_versions_and_status'
  },
  {
    up: migration_20260621_140000_articles_status_enum_extend.up,
    down: migration_20260621_140000_articles_status_enum_extend.down,
    name: '20260621_140000_articles_status_enum_extend'
  },
  {
    up: migration_20260622_100000_users_role_articles_status_enums.up,
    down: migration_20260622_100000_users_role_articles_status_enums.down,
    name: '20260622_100000_users_role_articles_status_enums',
  },
  {
    up: migration_20260622_100100_users_lifecycle_and_profile_fields.up,
    down: migration_20260622_100100_users_lifecycle_and_profile_fields.down,
    name: '20260622_100100_users_lifecycle_and_profile_fields',
  },
  {
    up: migration_20260622_100200_submissions_articles_media_review_fields.up,
    down: migration_20260622_100200_submissions_articles_media_review_fields.down,
    name: '20260622_100200_submissions_articles_media_review_fields',
  },
  {
    up: migration_20260622_100300_submissions_media_review_fields_repair.up,
    down: migration_20260622_100300_submissions_media_review_fields_repair.down,
    name: '20260622_100300_submissions_media_review_fields_repair',
  },
];
