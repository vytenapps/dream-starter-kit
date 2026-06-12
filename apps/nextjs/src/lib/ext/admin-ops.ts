import "server-only";

import { env } from "~/env";
import { createClient } from "~/lib/supabase/server";

/**
 * Shared plumbing for the /api/extensions/* admin routes (docs/
 * EXTENSIONS-PLAN.md §6): staff/admin gating via the caller's Supabase
 * session + profile, and the GitHub dispatch client for extension-ops.yml.
 * The deployed app can't run git/pnpm, so every mutation dispatches the
 * workflow, which runs the real CLI and opens a PR.
 */

export async function requireAdmin(): Promise<
  { ok: true } | { ok: false; res: Response }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      res: Response.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_staff")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_staff) {
    return {
      ok: false,
      res: Response.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { ok: true };
}

export function githubRepo(): string | null {
  if (env.GITHUB_REPO) return env.GITHUB_REPO;
  if (env.VERCEL_GIT_REPO_OWNER && env.VERCEL_GIT_REPO_SLUG) {
    return `${env.VERCEL_GIT_REPO_OWNER}/${env.VERCEL_GIT_REPO_SLUG}`;
  }
  return null;
}

export function opsConfigured(): boolean {
  return Boolean(env.GITHUB_OPS_TOKEN && githubRepo());
}

export async function githubApi(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const repo = githubRepo();
  if (!env.GITHUB_OPS_TOKEN || !repo) {
    return Response.json(
      {
        error:
          "Admin ops are not configured — set GITHUB_OPS_TOKEN (and GITHUB_REPO unless on Vercel). Until then, run the pnpm ext CLI locally.",
      },
      { status: 503 },
    );
  }
  return fetch(`https://api.github.com/repos/${repo}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${env.GITHUB_OPS_TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...init?.headers,
    },
  });
}
