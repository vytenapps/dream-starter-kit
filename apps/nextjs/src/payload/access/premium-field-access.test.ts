import { describe, expect, it } from "vitest";

import { premiumFieldAccess } from "./index";

/**
 * Regression guard for the premium-content paywall. `premiumFieldAccess` gates a
 * content field (e.g. Posts.body) by the doc's `accessLevel`, but Payload also
 * invokes field access during its permission/query-validation phase with NO
 * `doc` — that path must fail CLOSED for non-staff, or an anonymous REST caller
 * can filter on the gated field (`where[body][like]=…`) and use the result as a
 * boolean oracle to reconstruct withheld premium content.
 */

type Args = Parameters<typeof premiumFieldAccess>[0];

const call = (args: {
  user?: { roles: string[] };
  context?: { isPremium?: boolean; isLoggedIn?: boolean };
  doc?: { accessLevel?: string };
  siblingData?: { accessLevel?: string };
}) => {
  const { user, context, ...rest } = args;
  return premiumFieldAccess({
    req: { user, context },
    ...rest,
  } as unknown as Args);
};

const staff = { roles: ["editor"] };
const member = { roles: ["member"] };

describe("premiumFieldAccess", () => {
  it("fails closed for non-staff when there is no document context", () => {
    expect(call({})).toBe(false);
    expect(call({ user: member })).toBe(false);
    expect(call({ user: member, siblingData: {} })).toBe(false);
  });

  it("always allows staff, even with no document context", () => {
    expect(call({ user: staff })).toBe(true);
  });

  it("returns public content to anyone", () => {
    expect(call({ doc: { accessLevel: "public" } })).toBe(true);
  });

  it("gates premium content on an active entitlement", () => {
    const doc = { accessLevel: "premium" };
    expect(call({ context: { isPremium: true }, doc })).toBe(true);
    expect(call({ context: { isPremium: false }, doc })).toBe(false);
    expect(call({ doc })).toBe(false);
  });

  it("gates members content on being signed in", () => {
    const doc = { accessLevel: "members" };
    expect(call({ context: { isLoggedIn: true }, doc })).toBe(true);
    expect(call({ doc })).toBe(false);
  });
});
