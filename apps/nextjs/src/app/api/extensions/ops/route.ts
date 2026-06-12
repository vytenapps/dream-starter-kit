import { z } from "zod/v4";

import { githubApi, requireAdmin } from "~/lib/ext/admin-ops";

/**
 * Extension operations (docs/EXTENSIONS-PLAN.md §6): every mutation dispatches
 * .github/workflows/extension-ops.yml, which runs the real `pnpm ext` CLI on a
 * runner and opens a labeled PR — installed/updated code is always reviewed as
 * a diff and gated by CI before it can run. GET lists in-flight runs + PRs.
 */

const opSchema = z.object({
  op: z.enum(["add", "update", "remove"]),
  /** add: github url (#vX.Y.Z ok) or a signed zip URL; update/remove: unused. */
  source: z.string().optional(),
  slug: z.string().optional(),
  version: z.string().optional(),
  keepData: z.boolean().optional(),
  /** zip installs: sha256 the runner re-verifies after download. */
  sha256: z.string().optional(),
});

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  const parsed = opSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid op" }, { status: 400 });
  }
  const { op, source, slug, version, keepData, sha256 } = parsed.data;

  const res = await githubApi(
    "/actions/workflows/extension-ops.yml/dispatches",
    {
      method: "POST",
      body: JSON.stringify({
        ref: "main",
        inputs: {
          op,
          source: source ?? "",
          slug: slug ?? "",
          version: version ?? "",
          keep_data: keepData ? "true" : "false",
          sha256: sha256 ?? "",
        },
      }),
    },
  );
  if (res.status === 503) return res;
  if (!res.ok) {
    return Response.json(
      { error: `GitHub dispatch failed (${res.status})` },
      { status: 502 },
    );
  }
  return Response.json({ dispatched: true });
}

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  const [runsRes, prsRes] = await Promise.all([
    githubApi("/actions/workflows/extension-ops.yml/runs?per_page=10"),
    githubApi("/pulls?state=open&per_page=20"),
  ]);
  if (runsRes.status === 503) return runsRes;

  const runs = runsRes.ok
    ? ((await runsRes.json()) as {
        workflow_runs?: {
          id: number;
          status: string;
          conclusion: string | null;
          html_url: string;
          created_at: string;
          display_title: string;
        }[];
      })
    : { workflow_runs: [] };
  const prs = prsRes.ok
    ? ((await prsRes.json()) as {
        number: number;
        title: string;
        html_url: string;
        labels: { name: string }[];
        head: { ref: string };
      }[])
    : [];

  return Response.json({
    runs: (runs.workflow_runs ?? []).map((r) => ({
      id: r.id,
      status: r.status,
      conclusion: r.conclusion,
      url: r.html_url,
      createdAt: r.created_at,
      title: r.display_title,
    })),
    prs: prs
      .filter(
        (p) =>
          p.head.ref.startsWith("ext/") ||
          p.labels.some((l) => l.name.startsWith("extension")),
      )
      .map((p) => ({ number: p.number, title: p.title, url: p.html_url })),
  });
}
