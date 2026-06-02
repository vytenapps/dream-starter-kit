#!/usr/bin/env node
// License gate for the production dependency tree.
//
// Reads `pnpm licenses list --prod --json` from stdin and FAILS (exit 1) only on
// *strong* copyleft (GPL / AGPL / SSPL / EUPL / OSL / CECILL) that offers no
// permissive alternative. Weak/file-level copyleft (LGPL / MPL / EPL / CDDL) is
// allowed but reported — those are fine to depend on without relicensing this
// MIT kit, as long as you don't modify/bundle their source. SPDX "OR"
// expressions pass when any option is acceptable, e.g. "(BSD-3-Clause OR GPL-2.0)".
//
// Usage (see root package.json):
//   pnpm licenses list --prod --json | node tooling/scripts/check-licenses.mjs

import process from "node:process";

/** @param {string} token A single SPDX license id. */
function classify(token) {
  const t = token.trim().toUpperCase().replace(/^\(+|\)+$/g, "");
  // LGPL must be checked before GPL (it ends in "GPL" but is weak copyleft).
  if (/^(LGPL|MPL|EPL|CDDL)/.test(t)) return "weak";
  if (/^(AGPL|SSPL|EUPL|OSL|CECILL|GPL)/.test(t)) return "strong";
  return "permissive";
}

const splitOr = (expr) => String(expr).replace(/[()]/g, " ").split(/\s+OR\s+/i);
const splitAnd = (branch) =>
  branch
    .split(/\s+AND\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);

/** Every individual license id in an expression (both OR- and AND-separated). */
function allTokens(expr) {
  return splitOr(expr).flatMap(splitAnd);
}

// SPDX semantics: OR = you may pick one branch; AND = all terms bind together.
// So an expression is acceptable iff SOME OR-branch has NO strong-copyleft term.
// e.g. "(BSD-3-Clause OR GPL-2.0)" passes (pick BSD); "MIT AND GPL-2.0" fails
// (GPL's obligations bind even though MIT is permissive).
function isAcceptable(expr) {
  return splitOr(expr).some((branch) => {
    const terms = splitAnd(branch);
    return terms.length > 0 && terms.every((t) => classify(t) !== "strong");
  });
}

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  let data;
  try {
    data = JSON.parse(input || "{}");
  } catch {
    console.error("license:check — could not parse `pnpm licenses list --json`.");
    process.exit(1);
  }

  // pnpm emits { "<license>": [{ name, versions|version, ... }] }.
  const entries = Array.isArray(data)
    ? data.map((p) => [p.license ?? "UNKNOWN", [p]])
    : Object.entries(data);

  const namesFor = (pkgs) =>
    (Array.isArray(pkgs) ? pkgs : [])
      .map((p) => {
        const v = p.versions ?? p.version;
        const ver = Array.isArray(v) ? v.join(", ") : (v ?? "");
        return ver ? `${p.name}@${ver}` : p.name;
      })
      .filter(Boolean)
      .join(", ");

  const strong = [];
  const weak = [];
  for (const [license, pkgs] of entries) {
    const tokens = allTokens(license);
    if (!isAcceptable(license)) strong.push(`  ✗ ${license} → ${namesFor(pkgs)}`);
    else if (tokens.length > 0 && tokens.every((t) => classify(t) === "weak"))
      weak.push(`  • ${license} → ${namesFor(pkgs)}`);
  }

  if (weak.length) {
    console.log(
      `license:check — weak/file-level copyleft present (allowed as dependencies; review if you modify or statically bundle their source):\n${weak.join("\n")}\n`,
    );
  }

  if (strong.length) {
    console.error(
      `license:check — FAIL. Strong copyleft (GPL/AGPL/SSPL/…) with no permissive option:\n${strong.join("\n")}\n`,
    );
    process.exit(1);
  }

  console.log(
    `license:check — OK. No forbidden copyleft across ${entries.length} license expression(s) in the production tree.`,
  );
});
