import * as migration_20260609_224708_initial from './20260609_224708_initial';
import * as migration_20260610_212512_full_registry from './20260610_212512_full_registry';
import * as migration_20260610_221650_globals_extensions from './20260610_221650_globals_extensions';
import * as migration_20260610_230000_repair_migration_ledger from './20260610_230000_repair_migration_ledger';
import * as migration_20260611_222956_extensions_framework from './20260611_222956_extensions_framework';

export const migrations = [
  {
    up: migration_20260609_224708_initial.up,
    down: migration_20260609_224708_initial.down,
    name: '20260609_224708_initial',
  },
  {
    up: migration_20260610_212512_full_registry.up,
    down: migration_20260610_212512_full_registry.down,
    name: '20260610_212512_full_registry',
  },
  {
    up: migration_20260610_221650_globals_extensions.up,
    down: migration_20260610_221650_globals_extensions.down,
    name: '20260610_221650_globals_extensions',
  },
  {
    up: migration_20260610_230000_repair_migration_ledger.up,
    down: migration_20260610_230000_repair_migration_ledger.down,
    name: '20260610_230000_repair_migration_ledger',
  },
  {
    up: migration_20260611_222956_extensions_framework.up,
    down: migration_20260611_222956_extensions_framework.down,
    name: '20260611_222956_extensions_framework'
  },
];
