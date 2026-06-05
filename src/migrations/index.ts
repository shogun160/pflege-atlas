import * as migration_20260605_140707_init from './20260605_140707_init';

export const migrations = [
  {
    up: migration_20260605_140707_init.up,
    down: migration_20260605_140707_init.down,
    name: '20260605_140707_init'
  },
];
