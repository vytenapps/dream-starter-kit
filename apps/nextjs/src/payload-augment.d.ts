import type { Config } from "@acme/cms";

// Wires Payload's Local API generics to our generated collection types, so
// `payload.find({ collection: "posts" })` returns `Post`, etc. This lives
// in the web app (which has `payload` installed); the shared `@acme/cms` package
// stays augmentation-free so the Expo app needn't depend on `payload`.
declare module "payload" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface GeneratedTypes extends Config {}
}
