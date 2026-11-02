import { useEffect, useState } from "react";

const cache = new Map<string, Promise<unknown>>();

/** Fetches a JSON file shipped with the site (relative to the page), once per path. */
export function loadJson<T>(path: string): Promise<T> {
  let p = cache.get(path);
  if (!p) {
    p = fetch(path)
      .then((r) => {
        // Dev servers answer missing files with index.html; treat anything but JSON as missing.
        if (!r.ok || !r.headers.get("content-type")?.includes("json")) throw new Error(`${path}: not found (${r.status})`);
        return r.json();
      })
      .catch((e: unknown) => {
        cache.delete(path); // don't remember failures
        throw e;
      });
    cache.set(path, p);
  }
  return p as Promise<T>;
}

export function useJson<T>(path: string | null): { data: T | null; error: string | null } {
  const [state, setState] = useState<{ data: T | null; error: string | null }>({ data: null, error: null });
  useEffect(() => {
    if (!path) return;
    let live = true;
    setState({ data: null, error: null });
    loadJson<T>(path).then(
      (data) => live && setState({ data, error: null }),
      (e: unknown) => live && setState({ data: null, error: String(e) }),
    );
    return () => {
      live = false;
    };
  }, [path]);
  return state;
}

export const pct = (x: number | null | undefined, digits = 0) => (x === null || x === undefined ? "—" : `${(x * 100).toFixed(digits)}%`);
export const usd = (x: number | null | undefined, digits = 2) => (x === null || x === undefined ? "—" : `$${x.toFixed(digits)}`);
export const secs = (ms: number | null | undefined) => (ms === null || ms === undefined ? "—" : `${(ms / 1000).toFixed(1)} s`);
export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
