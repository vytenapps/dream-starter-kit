import * as migration_initial from "./20260613_025129_ext_chat_adapter_sendblue_initial";

export const migrations = [
  {
    up: migration_initial.up,
    down: migration_initial.down,
    name: "20260613_025129_ext_chat_adapter_sendblue_initial",
  },
];
