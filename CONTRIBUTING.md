# Contributing to Dream Starter Kit

Thanks for your interest in improving the kit! The full contributor guide lives
in the README so there's a single source of truth:

- **How to open a pull request + the pre-PR checklist:** [README → Contributing](./README.md#contributing)
- **How to report a bug or request a feature:** [README → Reporting issues](./README.md#reporting-issues)
- **Conventions and the step-by-step recipe for adding a feature:** [CLAUDE.md](./CLAUDE.md)

## TL;DR

```bash
nvm use                                   # Node 22
pnpm install
# make your change on a branch off main, then:
pnpm typecheck && pnpm lint && pnpm test  # must be green
```

- Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat(...)`, `fix(...)`, `docs(...)`).
- Keep cross-platform logic in `packages/`; keep `apps/*` thin.
- Database changes are **new, append-only** migrations — never edit a shipped one.
- Touching env vars? Update both `.env.example` and the zod schema in `packages/config`.
- Security issues: use GitHub's **private vulnerability reporting**, not a public issue.

By contributing, you agree that your contributions are licensed under the
project's [Apache License 2.0](./LICENSE).
