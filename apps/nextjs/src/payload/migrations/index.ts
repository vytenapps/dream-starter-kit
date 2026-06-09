import * as migration_20260609_224708_initial from './20260609_224708_initial';

export const migrations = [
  {
    up: migration_20260609_224708_initial.up,
    down: migration_20260609_224708_initial.down,
    name: '20260609_224708_initial'
  },
];
