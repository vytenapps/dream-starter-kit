import { describe, expect, it } from "vitest";

import { cmsNotConfiguredMessage, missingCmsEnv } from "./env-status";

describe("missingCmsEnv", () => {
  it("reports nothing missing when both vars are set", () => {
    expect(
      missingCmsEnv({
        PAYLOAD_SECRET: "s3cret",
        PAYLOAD_DATABASE_URL: "postgresql://payload_cms:pw@host/db",
      }),
    ).toEqual([]);
  });

  it("names each missing var (empty strings count as absent)", () => {
    expect(missingCmsEnv({})).toEqual([
      "PAYLOAD_SECRET",
      "PAYLOAD_DATABASE_URL",
    ]);
    expect(
      missingCmsEnv({ PAYLOAD_SECRET: "", PAYLOAD_DATABASE_URL: "url" }),
    ).toEqual(["PAYLOAD_SECRET"]);
    expect(missingCmsEnv({ PAYLOAD_SECRET: "s3cret" })).toEqual([
      "PAYLOAD_DATABASE_URL",
    ]);
  });
});

describe("cmsNotConfiguredMessage", () => {
  it("names the vars and points at the README + health endpoint", () => {
    const message = cmsNotConfiguredMessage([
      "PAYLOAD_SECRET",
      "PAYLOAD_DATABASE_URL",
    ]);
    expect(message).toContain("PAYLOAD_SECRET and PAYLOAD_DATABASE_URL");
    expect(message).toContain("/api/health/db");
    expect(message).toContain("Content backend");
  });
});
