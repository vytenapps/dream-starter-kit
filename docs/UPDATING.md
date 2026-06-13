# Staying up to date with the kit

> You forked or cloned the **Dream Starter Kit** and made it yours. The kit keeps
> evolving — bug fixes, new extensions, security hardening — and you want those
> changes without throwing away your own work. This is the **tested workflow** for
> pulling upstream into a downstream repo and keeping the relationship healthy so
> every future update is a routine three-way merge.
>
> **Conventions & recipes:** [`CLAUDE.md`](../CLAUDE.md). **Architecture:**
> [`ARCHITECTURE.md`](./ARCHITECTURE.md).

The whole thing rests on one git fact: a merge is clean and incremental only when
the two branches **share history** (a common ancestor). Get that ancestor in place
once, never squash it away, and updates stay easy forever.

---

## One-time setup — add the kit as a remote

Your fork has GitHub's built-in "upstream" relationship, but the CLI merge flow
needs a **named git remote** pointing at the kit:

```bash
git remote add upstream https://github.com/vytenapps/dream-starter-kit.git
git fetch upstream
```

Do this once per clone. `origin` stays your fork; `upstream` is the kit you pull from.

---

## Which starting situation are you in?

How you created your repo decides whether you already share history with the kit.
**Detect it** — from your default branch (e.g. `main`):

```bash
git merge-base main upstream/main
```

- **Prints a commit SHA → SHARED HISTORY.** You used GitHub's **"Fork"** button. A
  plain merge already works as a normal three-way merge — skip straight to
  [The routine](#the-routine-every-update). You're done with setup.
- **Prints nothing / exits non-zero → UNRELATED HISTORY.** You used **"Use this
  template"**, or cloned + `rm -rf .git && git init`, or started from a squashed
  "Initial commit" snapshot. Git has **no common ancestor**, so a plain
  `git merge upstream/main` fails (`refusing to merge unrelated histories`). Fix it
  **once** with the baseline merge below.

### Baseline merge (unrelated-history repos only, run once)

```bash
git checkout main
git merge upstream/main --allow-unrelated-histories
# resolve any conflicts, then:
git commit
```

> **This is nearly conflict-free if your tree already closely matches a known
> upstream commit.** Git diffs against an _empty_ tree for the common base, so
> files that are byte-identical on both sides merge cleanly — conflicts arise
> **only** on files whose content genuinely differs (your branding, your README,
> anything you edited). Resolve those with the same hotspot rules below.

After this single merge, `upstream/main` becomes a **real ancestor** of your `main`.
From now on `git merge-base` resolves, and **all** future updates are ordinary
three-way merges — you never pass `--allow-unrelated-histories` again.

---

## The routine (every update)

Once history is shared, every sync is the same four-step loop:

```bash
git fetch upstream
git checkout -b sync/upstream-$(date +%Y-%m-%d)   # branch off your main
git merge upstream/main                            # real conflicts ONLY where you
                                                   #   edited the same lines the kit did
# resolve conflicts (see hotspots below), then run the gates:
pnpm install && pnpm typecheck && pnpm lint && pnpm test
# open a PR from sync/upstream-YYYY-MM-DD into your main
```

That's it. Because you share history, the merge only surfaces conflicts on lines
**you** changed that the kit **also** changed — everything else fast-forwards in.

### Critical — do NOT squash sync PRs

Land the sync PR with a **merge commit** or a **rebase/fast-forward** — never
"Squash and merge."

> Squashing flattens the merge commit that records `upstream/main` as an ancestor.
> Lose that commit and git forgets you share history: your next `git merge-base`
> comes up empty and you're back to `--allow-unrelated-histories` and a wall of
> phantom conflicts. **One squash undoes the whole setup.**

Set your fork's merge method accordingly (GitHub → repo **Settings → General →
Pull Requests**: allow merge commits / rebase merging), or just remember to pick a
non-squash method **on sync PRs specifically**. Feature PRs inside your own fork can
squash freely — this only matters for PRs that carry an upstream merge.

---

## Conflict hotspots

Most conflicts cluster in a handful of predictable places. Handle each by its kind,
not line-by-line:

- **Generated files — REGENERATE, never hand-merge.** Take _either_ side, then
  rebuild:
  - `packages/cms/src/payload-types.ts` → `pnpm cms:gen-types`
  - Supabase types (`packages/api`) → `pnpm db:gen-types`
- **`packages/cms/src/payload-types.ts` phantom churn.** Even with no real type
  change, a `pnpm db:reset`/generate reorders things non-deterministically
  (single- vs double-quotes, `SupportedTimezones` reordering). That's **formatting
  noise**, not a type change — discard it: `git checkout -- packages/cms/src/payload-types.ts`.
- **Migrations are append-only.** Never edit a shipped migration; **keep BOTH
  sides'** migration files (yours _and_ the kit's new ones). After merging, run
  `pnpm db:reset` to apply the combined sequence, then `pnpm db:gen-migrations` if
  the runtime-bundle JSON drifted (drift fails `pnpm test`).
- **Env — reconcile both halves.** A new kit var means editing **both**
  `.env.example` **and** the zod schema in `packages/config`. Take both sides' new
  vars; keep your own values in your local `.env` (which isn't committed).
- **`pnpm-lock.yaml` — don't hand-merge.** Take either side, then regenerate with
  `pnpm install`.

---

## Files you intentionally diverge on

Branding, your own CI workflows, your README — files you've rewritten and never want
upstream to clobber. Pin them with a **merge driver** so upstream edits are silently
ignored:

```bash
# .gitattributes (committed — applies the driver to these paths on merge)
README.md          merge=ours
.github/workflows/** merge=ours
apps/expo/app.config.ts merge=ours
```

```bash
# enable the driver — per-clone, NOT committed (git has no built-in "ours" driver)
git config merge.ours.driver true
```

> **Caveat — `merge=ours` only covers content conflicts on files present on both
> sides.** It does **not** cover **modify/delete**: a file you _deleted_ that
> upstream later edits still raises a modify/delete conflict. Resolve those by
> re-deleting (`git rm <file>`). And remember the `git config` line is **local to
> each clone** — re-run it after a fresh clone, and tell collaborators to as well.

---

## Post-merge validation

Before you merge the sync PR, prove the combined tree actually works:

```bash
pnpm install          # reconcile the lockfile
pnpm db:reset         # apply the merged migration sequence (+ cms:migrate)
pnpm cms:gen-types    # regenerate Payload types
pnpm db:gen-types     # regenerate Supabase types
pnpm typecheck && pnpm lint && pnpm test
pnpm test:rls         # ONLY if the merge touched schema or RLS (needs supabase start)
```

These are the same gates the kit's own CI runs (see [`CLAUDE.md`](../CLAUDE.md) →
Commands). Green here means the merge is safe to land.

---

## Alternative — cherry-pick a single urgent fix

Need one specific upstream fix _now_, without a full sync? Cherry-pick it — it's
patch-based, so it works **even across unrelated histories** (no baseline merge
required):

```bash
git fetch upstream
git log upstream/main --oneline      # find the commit
git cherry-pick <sha>
```

This doesn't establish shared history (only a real merge does that), so it's a
stopgap, not a substitute for the routine — do a proper sync when you can.

---

## Doing this with Claude Code

If you run Claude Code in your fork, just ask it to _"sync with upstream"_ — the
routine, hotspots and the no-squash rule are encoded in [`CLAUDE.md`](../CLAUDE.md)
(→ **Staying current with the kit (upstream sync)**), so the agent follows the same
steps, regenerates the right files, and runs the gates before opening the PR.
