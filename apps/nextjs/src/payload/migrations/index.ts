import * as migration_20260609_195302_initial from './20260609_195302_initial';
import * as migration_20260609_212729_brand_link from './20260609_212729_brand_link';
import * as migration_20260609_222155_remove_link_type from './20260609_222155_remove_link_type';

export const migrations = [
  {
    up: migration_20260609_195302_initial.up,
    down: migration_20260609_195302_initial.down,
    name: '20260609_195302_initial',
  },
  {
    up: migration_20260609_212729_brand_link.up,
    down: migration_20260609_212729_brand_link.down,
    name: '20260609_212729_brand_link',
  },
  {
    up: migration_20260609_222155_remove_link_type.up,
    down: migration_20260609_222155_remove_link_type.down,
    name: '20260609_222155_remove_link_type'
  },
];
