/**
 * @acme/ext-kit — the extension framework's typed contracts.
 *
 * This barrel is CLIENT-SAFE (no payload, no node built-ins): manifest types +
 * `defineExtension` + pure validation logic. Server route contracts live in
 * `@acme/ext-kit/server`; Payload-side helpers (settings, seed steps) live in
 * `@acme/ext-kit/payload`.
 */
export * from "./manifest";
export * from "./validate";
