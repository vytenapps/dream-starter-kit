import { describe, expect, it } from "vitest";

import { docPath, generatePreviewPath } from "./preview";

describe("docPath", () => {
  it("maps the home page (and a missing slug) to /", () => {
    expect(docPath("pages", "home")).toBe("/");
    expect(docPath("pages", undefined)).toBe("/");
    expect(docPath("pages", null)).toBe("/");
  });

  it("maps other pages to /{slug}", () => {
    expect(docPath("pages", "about")).toBe("/about");
    expect(docPath("pages", "terms")).toBe("/terms");
  });

  it("maps other collections to /{collection}/{slug}", () => {
    expect(docPath("posts", "hello-world")).toBe("/posts/hello-world");
    expect(docPath("events", "launch-party")).toBe("/events/launch-party");
    expect(docPath("locations", "hq")).toBe("/locations/hq");
  });
});

describe("generatePreviewPath", () => {
  it("targets /next/preview with the encoded path, collection and slug", () => {
    const url = generatePreviewPath({ collection: "pages", slug: "about" });
    expect(url.startsWith("/next/preview?")).toBe(true);

    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("path")).toBe("/about");
    expect(params.get("collection")).toBe("pages");
    expect(params.get("slug")).toBe("about");
  });

  it("omits the secret param when PAYLOAD_PREVIEW_SECRET is unset", () => {
    const url = generatePreviewPath({ collection: "pages", slug: "home" });
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.has("secret")).toBe(false);
    expect(params.get("path")).toBe("/");
  });

  it("targets the collection's detail path for posts/events/locations", () => {
    for (const collection of ["posts", "events", "locations"]) {
      const url = generatePreviewPath({ collection, slug: "demo" });
      const params = new URLSearchParams(url.split("?")[1]);
      expect(params.get("path")).toBe(`/${collection}/demo`);
      expect(params.get("collection")).toBe(collection);
      expect(params.get("slug")).toBe("demo");
    }
  });
});
