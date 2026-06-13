import type { Config } from "@acme/cms";

// Wires Payload's Local API generics to the kit's generated collection types,
// same as the host's payload-augment.d.ts, so finds return typed docs.
declare module "payload" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface GeneratedTypes extends Config {}
}
