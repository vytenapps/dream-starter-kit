import type { Location as LocationDoc } from "@acme/cms";

/**
 * One-line postal address from a location's structured `address` group. Pure +
 * client-safe (no `server-only`), so both the server routes and the client Live
 * Preview wrapper can use it. Re-exported from `lib/payload` for convenience.
 */
export function formatAddress(address: LocationDoc["address"]): string | null {
  if (!address) return null;
  const parts = [
    address.street,
    address.street2,
    address.city,
    address.region,
    address.postalCode,
    address.country,
  ].filter((p): p is string => Boolean(p?.trim()));
  return parts.length > 0 ? parts.join(", ") : null;
}
