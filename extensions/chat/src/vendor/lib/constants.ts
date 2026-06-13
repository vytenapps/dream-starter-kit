// KIT ADAPTATION (see VENDOR.md): auth/password constants dropped (Supabase
// owns auth); API_BASE/CHAT_PATH centralize the kit's mount points.

export const isProductionEnvironment = process.env.NODE_ENV === "production";
export const isDevelopmentEnvironment = process.env.NODE_ENV === "development";
export const isTestEnvironment = Boolean(
  process.env.PLAYWRIGHT_TEST_BASE_URL ||
    process.env.PLAYWRIGHT ||
    process.env.CI_PLAYWRIGHT,
);

/** The chat extension's dispatcher mount — all client fetches go through it. */
export const API_BASE = "/api/ext/chat";

/** Where the chat UI lives (the extension's /a/<slug> mount). */
export const CHAT_PATH = "/a/chat";

export const suggestions = [
  "What are the advantages of using Next.js?",
  "Write code to demonstrate Dijkstra's algorithm",
  "Help me write an essay about Silicon Valley",
  "What is the weather in San Francisco?",
];
