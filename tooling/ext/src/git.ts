import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Git plumbing for the vendored-extension lifecycle (docs/EXTENSIONS-PLAN.md
 * §4): pristine-base snapshot refs (refs/ext-base/<slug>) that make updates a
 * real three-way merge even after squash merges, and local-modification
 * detection against the pinned base.
 */

export function git(repoRoot: string, args: string[], input?: string): string {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    input,
    maxBuffer: 64 * 1024 * 1024,
  }).trim();
}

const baseRef = (slug: string) => `refs/ext-base/${slug}`;

/**
 * Synthetic commit of the CURRENT worktree state of extensions/<slug>/ (no
 * ref update) — the building block for snapshots and three-way merges.
 */
export function commitExtensionTree(
  repoRoot: string,
  slug: string,
  message: string,
  parent?: string,
): string {
  const indexFile = path.join(
    mkdtempSync(path.join(tmpdir(), "ext-index-")),
    "index",
  );
  const env = { ...process.env, GIT_INDEX_FILE: indexFile };
  const run = (args: string[]) =>
    execFileSync("git", args, { cwd: repoRoot, encoding: "utf8", env }).trim();
  try {
    run(["read-tree", "--empty"]);
    run(["add", "-f", `extensions/${slug}`]);
    const tree = run(["write-tree"]);
    return git(repoRoot, [
      "commit-tree",
      tree,
      ...(parent ? ["-p", parent] : []),
      "-m",
      message,
    ]);
  } finally {
    rmSync(path.dirname(indexFile), { recursive: true, force: true });
  }
}

export function currentBase(repoRoot: string, slug: string): string | null {
  try {
    return git(repoRoot, ["rev-parse", "--verify", baseRef(slug)]);
  } catch {
    return null;
  }
}

/**
 * Write a synthetic commit containing ONLY the current (pristine) tree of
 * extensions/<slug>/ and advance refs/ext-base/<slug> to it (chaining the
 * previous base as parent so history stays reachable). Returns the commit sha.
 */
export function snapshotExtension(
  repoRoot: string,
  slug: string,
  version: string,
): string {
  const commit = commitExtensionTree(
    repoRoot,
    slug,
    `ext-base: ${slug} v${version}`,
    currentBase(repoRoot, slug) ?? undefined,
  );
  git(repoRoot, ["update-ref", baseRef(slug), commit]);
  return commit;
}

/** Files under extensions/<slug>/ differing from the pinned pristine base. */
export function modifiedFiles(
  repoRoot: string,
  slug: string,
  baseCommit: string,
): string[] {
  try {
    const out = git(repoRoot, [
      "diff",
      "--name-only",
      baseCommit,
      "--",
      `extensions/${slug}`,
    ]);
    return out === "" ? [] : out.split("\n");
  } catch {
    // Base commit unreachable (e.g. ref lost on a fresh clone) — unknown.
    return [];
  }
}

export interface MergeResult {
  tree: string;
  conflicts: string[];
}

/**
 * Three-way merge: base (pinned pristine), ours (current vendored tree,
 * possibly locally modified), theirs (new upstream snapshot). Conflicted
 * files carry standard markers in the written tree.
 */
export function mergeTrees(
  repoRoot: string,
  base: string,
  ours: string,
  theirs: string,
): MergeResult {
  try {
    const tree = git(repoRoot, [
      "merge-tree",
      "--write-tree",
      `--merge-base=${base}`,
      ours,
      theirs,
    ]);
    return { tree: tree.split("\n")[0] ?? tree, conflicts: [] };
  } catch (err) {
    // Exit 1 = conflicts; stdout still carries the tree + conflict listing.
    const out = (err as { stdout?: string }).stdout?.toString().trim() ?? "";
    const [tree = "", ...rest] = out.split("\n");
    const conflicts = [
      ...new Set(
        rest
          .filter((l) => l.startsWith("CONFLICT") === false && l.includes("\t"))
          .map((l) => l.split("\t").pop() ?? "")
          .filter(Boolean),
      ),
    ];
    if (!tree) throw err;
    return { tree, conflicts };
  }
}

/** Materialize `extensions/<slug>` out of a tree-ish into the worktree. */
export function checkoutExtensionTree(
  repoRoot: string,
  slug: string,
  treeish: string,
): void {
  rmSync(path.join(repoRoot, "extensions", slug), {
    recursive: true,
    force: true,
  });
  execFileSync(
    "bash",
    ["-c", `git archive ${treeish} extensions/${slug} | tar -x`],
    { cwd: repoRoot },
  );
}
