/**
 * Server-rendered web entry (RSC pages using the Payload Local API) — kept
 * separate from ./web so the client registry's widget imports never pull
 * payload/node modules into client chunks.
 */
export { PricingPage } from "./pricing-page";
