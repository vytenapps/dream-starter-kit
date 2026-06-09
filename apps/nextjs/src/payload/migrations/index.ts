import * as migration_20260609_195302_initial from './20260609_195302_initial';

export const migrations = [
  {
    up: migration_20260609_195302_initial.up,
    down: migration_20260609_195302_initial.down,
    name: '20260609_195302_initial'
  },
];
