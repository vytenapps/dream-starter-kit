import * as migration_20260609_224708_initial from './20260609_224708_initial';
import * as migration_20260610_212512_full_registry from './20260610_212512_full_registry';
import * as migration_20260610_221650_globals_extensions from './20260610_221650_globals_extensions';
import * as migration_20260610_230000_repair_migration_ledger from './20260610_230000_repair_migration_ledger';
import * as migration_20260611_222956_extensions_framework from './20260611_222956_extensions_framework';
import * as migration_20260612_015425_ext_chat_settings from './20260612_015425_ext_chat_settings';
import * as migration_20260612_023534_ext_billing from './20260612_023534_ext_billing';
import * as migration_20260612_032502_drop_ext_demo from './20260612_032502_drop_ext_demo';
import * as migration_20260612_222154_add_item_tooltip from './20260612_222154_add_item_tooltip';
import * as migration_20260613_021834_ext_chat_skills_and_settings_tabs from './20260613_021834_ext_chat_skills_and_settings_tabs';
import * as migration_20260613_023123_ext_docs_initial from './20260613_023123_ext_docs_initial';
import * as migration_20260613_025126_ext_chat_adapter_slack_initial from './20260613_025126_ext_chat_adapter_slack_initial';
import * as migration_20260613_025129_ext_chat_adapter_sendblue_initial from './20260613_025129_ext_chat_adapter_sendblue_initial';
import * as migration_20260613_161650_ai_chat_adapter_settings_tabs from './20260613_161650_ai_chat_adapter_settings_tabs';
import * as migration_20260620_212733_image_generation from './20260620_212733_image_generation';
import * as migration_20260624_000100_drop_favorites from './20260624_000100_drop_favorites';
import * as migration_20260624_151421_image_audit_settings from './20260624_151421_image_audit_settings';
import * as migration_20260702_173249_authentication_settings from './20260702_173249_authentication_settings';

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
    name: '20260611_222956_extensions_framework',
  },
  {
    up: migration_20260612_015425_ext_chat_settings.up,
    down: migration_20260612_015425_ext_chat_settings.down,
    name: '20260612_015425_ext_chat_settings',
  },
  {
    up: migration_20260612_023534_ext_billing.up,
    down: migration_20260612_023534_ext_billing.down,
    name: '20260612_023534_ext_billing',
  },
  {
    up: migration_20260612_032502_drop_ext_demo.up,
    down: migration_20260612_032502_drop_ext_demo.down,
    name: '20260612_032502_drop_ext_demo',
  },
  {
    up: migration_20260612_222154_add_item_tooltip.up,
    down: migration_20260612_222154_add_item_tooltip.down,
    name: '20260612_222154_add_item_tooltip',
  },
  {
    up: migration_20260613_021834_ext_chat_skills_and_settings_tabs.up,
    down: migration_20260613_021834_ext_chat_skills_and_settings_tabs.down,
    name: '20260613_021834_ext_chat_skills_and_settings_tabs',
  },
  {
    up: migration_20260613_023123_ext_docs_initial.up,
    down: migration_20260613_023123_ext_docs_initial.down,
    name: '20260613_023123_ext_docs_initial',
  },
  {
    up: migration_20260613_025126_ext_chat_adapter_slack_initial.up,
    down: migration_20260613_025126_ext_chat_adapter_slack_initial.down,
    name: '20260613_025126_ext_chat_adapter_slack_initial',
  },
  {
    up: migration_20260613_025129_ext_chat_adapter_sendblue_initial.up,
    down: migration_20260613_025129_ext_chat_adapter_sendblue_initial.down,
    name: '20260613_025129_ext_chat_adapter_sendblue_initial',
  },
  {
    up: migration_20260613_161650_ai_chat_adapter_settings_tabs.up,
    down: migration_20260613_161650_ai_chat_adapter_settings_tabs.down,
    name: '20260613_161650_ai_chat_adapter_settings_tabs',
  },
  {
    up: migration_20260620_212733_image_generation.up,
    down: migration_20260620_212733_image_generation.down,
    name: '20260620_212733_image_generation',
  },
  {
    up: migration_20260624_000100_drop_favorites.up,
    down: migration_20260624_000100_drop_favorites.down,
    name: '20260624_000100_drop_favorites',
  },
  {
    up: migration_20260624_151421_image_audit_settings.up,
    down: migration_20260624_151421_image_audit_settings.down,
    name: '20260624_151421_image_audit_settings',
  },
  {
    up: migration_20260702_173249_authentication_settings.up,
    down: migration_20260702_173249_authentication_settings.down,
    name: '20260702_173249_authentication_settings'
  },
];
