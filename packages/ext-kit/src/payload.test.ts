import { describe, expect, it } from "vitest";

import {
  adapterGroupName,
  composeSettingsTabs,
  defineAdapterSettings,
  defineExtensionSettings,
} from "./payload";

describe("adapterGroupName", () => {
  it("turns a slug into a valid group field name", () => {
    expect(adapterGroupName("chat-adapter-slack")).toBe(
      "adapter_chat_adapter_slack",
    );
  });
});

describe("defineAdapterSettings", () => {
  const adapter = defineAdapterSettings({
    slug: "chat-adapter-slack",
    name: "Slack",
    target: "chat",
    description: "Answer in Slack.",
    fields: [{ name: "enabled", type: "checkbox", defaultValue: true }],
  });

  it("namespaces fields under a per-adapter group and collects inner defaults", () => {
    expect(adapter.target).toBe("chat");
    expect(adapter.groupName).toBe("adapter_chat_adapter_slack");
    expect(adapter.defaults).toEqual({ enabled: true });
    expect(adapter.tab.label).toBe("Slack");
    // One wrapping group named for the adapter holds the author fields.
    const group = adapter.tab.fields[0] as {
      name: string;
      type: string;
      fields: { name: string }[];
    };
    expect(group).toMatchObject({
      name: "adapter_chat_adapter_slack",
      type: "group",
    });
    expect(group.fields[0]?.name).toBe("enabled");
  });
});

describe("composeSettingsTabs", () => {
  const base = defineExtensionSettings({
    slug: "chat",
    name: "AI Chat",
    fields: [
      {
        type: "tabs",
        tabs: [{ label: "General", fields: [] }],
      },
    ],
  });
  const slack = defineAdapterSettings({
    slug: "chat-adapter-slack",
    name: "Slack",
    target: "chat",
    fields: [{ name: "enabled", type: "checkbox", defaultValue: true }],
  });

  it("appends each adapter tab to the base tabs field and nests its defaults", () => {
    const composed = composeSettingsTabs(base, [slack]);
    const tabsField = composed.global.fields[0] as {
      tabs: { label: string }[];
    };
    expect(tabsField.tabs.map((t) => t.label)).toEqual(["General", "Slack"]);
    expect(composed.defaults).toMatchObject({
      adapter_chat_adapter_slack: { enabled: true },
    });
  });

  it("returns the base unchanged when there are no adapters", () => {
    expect(composeSettingsTabs(base, [])).toBe(base);
  });

  it("does not mutate the base settings", () => {
    composeSettingsTabs(base, [slack]);
    const baseTabs = base.global.fields[0] as { tabs: unknown[] };
    expect(baseTabs.tabs).toHaveLength(1);
    expect(base.defaults).not.toHaveProperty("adapter_chat_adapter_slack");
  });
});
