/**
 * Node module-customization hooks that neutralize CSS/asset imports for the
 * Payload CLI scripts (`pnpm cms:seed`, `pnpm cms:backfill-users`).
 *
 * Those scripts run `tsx src/payload/<script>.ts`, which loads the full
 * `payload.config.ts` import graph. Bundlers (Next.js, Metro) understand a
 * side-effect `import "./x.css"` or an imported image, but Node — even via
 * tsx/esbuild — throws `ERR_UNKNOWN_FILE_EXTENSION` the moment such a module
 * enters the graph. Admin components are referenced by string path so they
 * stay out of the runtime graph today, but this is a clone-and-extend kit:
 * the first collection/field/hook that pulls a stylesheet or asset into a
 * server module would break `cms:seed` with an opaque ESM error. These hooks
 * make those imports resolve to an inert empty module so the CLI keeps
 * working — the seed never touches the visual asset anyway.
 *
 * Registered via ./register-cli-loaders.mjs (see apps/nextjs/package.json).
 * Scoped to the CLI only; the Next.js build and runtime are untouched.
 */
const ASSET_RE =
  /\.(css|scss|sass|less|styl|png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|otf|eot)(\?.*)?$/i;

const STUB_SCHEME = "kit-asset-stub:";

/** @type {import("node:module").ResolveHook} */
export function resolve(specifier, context, nextResolve) {
  if (ASSET_RE.test(specifier)) {
    return { url: STUB_SCHEME + specifier, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}

/** @type {import("node:module").LoadHook} */
export function load(url, context, nextLoad) {
  if (url.startsWith(STUB_SCHEME)) {
    return {
      format: "module",
      source: "export default {};",
      shortCircuit: true,
    };
  }
  return nextLoad(url, context);
}
