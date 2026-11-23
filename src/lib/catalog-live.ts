import { applyCatalogOverrides, getCatalogOverridesSnapshot, type CatalogOverrides } from "@/lib/catalog";
import { getCatalogOverrides } from "@/lib/catalog.functions";

/** Browser only: one shared request at a time. */
let inflight: Promise<CatalogOverrides> | null = null;
let loadedAt = 0;
/** Server only: the last loaded edits as plain data (a promise must never outlive the request that made it). */
let serverCache: { at: number; value: CatalogOverrides } | null = null;

function request(fresh: boolean): Promise<CatalogOverrides> {
  return getCatalogOverrides({ data: { fresh } }).then((o) => {
    applyCatalogOverrides(o);
    return o;
  });
}

/**
 * Loads the admin's novel/video edits into the live catalog. Cached briefly (30s on the server,
 * 60s in the browser); pass fresh after an admin save. Never throws: on failure the site keeps
 * showing the last known library.
 */
export function loadCatalog(opts: { fresh?: boolean } = {}): Promise<CatalogOverrides> {
  const fresh = Boolean(opts.fresh);

  if (typeof window === "undefined") {
    if (!fresh && serverCache && Date.now() - serverCache.at < 30_000) {
      applyCatalogOverrides(serverCache.value);
      return Promise.resolve(serverCache.value);
    }
    return request(fresh)
      .then((value) => {
        serverCache = { at: Date.now(), value };
        return value;
      })
      .catch((error: unknown) => {
        console.warn("Could not load admin catalog edits; showing the saved library.", error);
        return getCatalogOverridesSnapshot();
      });
  }

  if (!fresh && inflight && Date.now() - loadedAt < 60_000) return inflight;
  loadedAt = Date.now();
  const pending = request(fresh).catch((error: unknown) => {
    console.warn("Could not load admin catalog edits; showing the saved library.", error);
    if (inflight === pending) inflight = null;
    return getCatalogOverridesSnapshot();
  });
  inflight = pending;
  return pending;
}
