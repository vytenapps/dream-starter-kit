# Security Policy

## Reporting a vulnerability

**Please do not open a public issue for security vulnerabilities.**

Report them privately through GitHub's **private vulnerability reporting**:
open the repository's **Security** tab → **Report a vulnerability**. If that isn't
available, contact the maintainers privately instead.

When reporting, please include:

- a description of the issue and its impact,
- steps to reproduce (or a proof of concept),
- the affected area (web, mobile, or backend / edge functions), and
- any suggested remediation if you have one.

We'll acknowledge your report, work on a fix, and coordinate disclosure with you.
Please allow a reasonable amount of time for a fix before any public disclosure.

## Scope notes for this starter

This is a clone-and-ship template, so a few things are intentional and **not**
vulnerabilities:

- The database ships with an **empty seed** (no demo accounts) — the first UI
  signup becomes the owner. The well-known **local** Supabase keys exist only for
  local development and tests.
- The committed `.env.example` contains **placeholders only** — never real secrets.

Security-relevant invariants we *do* care about (please report breaks):

- **Row-Level Security on every table** — a user must never be able to read or
  write another user's rows.
- **The service-role key is server-only** — it must never reach the web client
  or the mobile bundle.
- **Server routes that touch AI/billing are authenticated** (and the AI route is
  rate-limited and token-capped).
