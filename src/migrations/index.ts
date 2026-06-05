import * as migration_20260605_052951_users_extended from './20260605_052951_users_extended';
import * as migration_20260605_053513_add_articles from './20260605_053513_add_articles';
import * as migration_20260605_053850_add_submissions from './20260605_053850_add_submissions';

export const migrations = [
  {
    up: migration_20260605_052951_users_extended.up,
    down: migration_20260605_052951_users_extended.down,
    name: '20260605_052951_users_extended',
  },
  {
    up: migration_20260605_053513_add_articles.up,
    down: migration_20260605_053513_add_articles.down,
    name: '20260605_053513_add_articles',
  },
  {
    up: migration_20260605_053850_add_submissions.up,
    down: migration_20260605_053850_add_submissions.down,
    name: '20260605_053850_add_submissions'
  },
];
