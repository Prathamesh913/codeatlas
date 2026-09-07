// CodeAtlas — Router / bootstrap aggregation policy (No Misleading Canonical Map)
//
// A root router, application bootstrap file, server entry point, or router
// aggregation file may import or mount downstream routers. That structural
// fact is routing TOPOLOGY, never semantic ownership:
//   - it must not assign the aggregator to a downstream feature/system,
//   - it must not emit a false semantic SUPPORTS/USES ownership edge,
//   - legitimate downstream router/controller/service memberships stay intact.
//
// Topology is emitted, where supported, as a `ROUTES_TO` relationship —
// clearly distinguished from semantic ownership (`SUPPORTS`/`USES`/
// `DEPENDS_ON`). Without explicit source-supported ownership annotation the
// aggregator stays unassigned (or infrastructure/bootstrap with conservative
// evidence), never force-mapped.

const AGGREGATION_BASENAMES = new Set([
  'index', 'app', 'main', 'server', 'bootstrap', 'router', 'routers',
  'routes', 'api', 'root', 'app-router', 'app-routes', 'main-router',
]);

const ROUTER_SYMBOL_HINTS = [
  'createrouter', 'createbrowserrouter', 'router', 'routes', 'mount',
  'useRoutes', 'Switch', 'Route',
];

/** Basename (no directory, no extension) of a repo-relative path. */
export function basenameNoExt(path) {
  const base = String(path).split('/').pop() || '';
  return base.replace(/\.[A-Za-z0-9]+$/, '').toLowerCase();
}

/**
 * Conservative structural heuristic: is this file shaped like a router
 * aggregation / bootstrap / entry point? Filename-shaped OR (router-ish
 * filename AND declares router-ish symbols). Never uses file content beyond
 * declared symbols already recorded in the graph.
 */
export function isAggregationShaped(path, declares = []) {
  const base = basenameNoExt(path);
  if (AGGREGATION_BASENAMES.has(base)) return true;
  const lower = String(path).toLowerCase();
  const routerishPath = lower.includes('rout') || lower.includes('app.') || lower.includes('server') || lower.includes('main.') || lower.includes('index.');
  if (!routerishPath) return false;
  const syms = (declares || []).map((s) => String(s).toLowerCase());
  return syms.some((s) => ROUTER_SYMBOL_HINTS.some((h) => s.includes(h.toLowerCase())));
}

/**
 * Explicit source-supported ownership evidence for an aggregation file:
 * a capability-class string observed in that file, or a behavioral clue
 * tying it to a domain. Import/mount edges alone never count.
 */
export function hasExplicitOwnershipEvidence({ capabilityStrings = [], behaviorClues = [] } = {}) {
  return (capabilityStrings || []).length > 0 || (behaviorClues || []).length > 0;
}

/**
 * Classify an import edge out of an aggregation file for relationship
 * emission. Returns `topology` (emit ROUTES_TO) when the edge is pure
 * router mounting without explicit ownership evidence, else `semantic`
 * (normal ownership rules may apply).
 */
export function classifyRouterEdge({ fromFile, fromDeclares = [], explicitOwnership = false }) {
  if (!isAggregationShaped(fromFile, fromDeclares)) return 'semantic';
  if (explicitOwnership) return 'semantic';
  return 'topology';
}
