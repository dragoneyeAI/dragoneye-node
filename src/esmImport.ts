// Utilities for loading ESM-only dependencies from this CommonJS package.
//
// A static `import` of an ESM-only module would force our consumers onto ESM,
// and `await import(...)` is transpiled to `require(...)` under
// "module": "commonjs", which fails at runtime for ESM-only packages. The
// Function wrapper below preserves a real dynamic `import()` call in the
// emitted JS, giving us runtime ESM interop while keeping the package CJS.

export const dynamicImport = new Function(
  "specifier",
  "return import(specifier)"
) as <T = unknown>(specifier: string) => Promise<T>;

// Memoize an async loader so repeated callers share one import promise.
export function lazy<T>(load: () => Promise<T>): () => Promise<T> {
  let promise: Promise<T> | undefined;
  return () => (promise ??= load());
}
