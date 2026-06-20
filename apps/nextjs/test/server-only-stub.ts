// Empty stub aliased in for `server-only` under vitest. The real `server-only`
// package's default export throws (it's a Server-Component-only marker), which
// would break importing server libs (e.g. lib/image-generation.ts) in node
// unit tests. Mirrors the package's own `react-server` → empty.js behavior.
export {};
