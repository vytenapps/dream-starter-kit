import type { Page } from "@acme/cms";

import { CmsRichText } from "~/components/rich-text";

/** Renders a Payload `pages` document (title + rich-text body). */
export function PageView({ page }: { page: Page }) {
  return (
    <main className="container mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">{page.title}</h1>
      <div className="mt-6">
        <CmsRichText data={page.body} />
      </div>
    </main>
  );
}
