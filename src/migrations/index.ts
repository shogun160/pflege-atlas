import * as migration_20260605_052951_users_extended from './20260605_052951_users_extended';

export const migrations = [
  {
    up: migration_20260605_052951_users_extended.up,
    down: migration_20260605_052951_users_extended.down,
    name: '20260605_052951_users_extended'
  },
];
