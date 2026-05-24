/**
 * Lightweight test doubles for the pi-crust extension host surface and for
 * React. Kept dependency-free so `node --test` can run the suite without
 * any install step.
 */

/**
 * Build a fake `prc` object matching the contract that server.mjs expects:
 *   prc.server.api.{get,post,put,patch}(path, handler)
 *   prc.settings.registerSection(section)
 *   prc.sessions.get(id) -> session
 *   prc.configDir (optional override)
 */
export function makeFakePrc({ configDir, sessions = {} } = {}) {
  /** @type {Array<{ method: string, path: string, handler: Function }>} */
  const routes = [];
  /** @type {Array<object>} */
  const settingsSections = [];

  function register(method) {
    return (routePath, handler) => { routes.push({ method, path: routePath, handler }); };
  }

  return {
    configDir,
    server: {
      api: {
        get: register('GET'),
        post: register('POST'),
        put: register('PUT'),
        patch: register('PATCH'),
      },
    },
    settings: {
      registerSection(section) { settingsSections.push(section); },
    },
    sessions: {
      async get(id) {
        if (id in sessions) return sessions[id];
        throw new Error(`unknown session: ${id}`);
      },
    },
    /** Test-only inspector helpers (not part of the real prc surface). */
    _routes: routes,
    _settingsSections: settingsSections,
    _findRoute(method, path) {
      return routes.find((r) => r.method === method && r.path === path);
    },
  };
}

/**
 * Minimal React stand-in supporting createElement + useState + useEffect.
 * State cells are persisted across renders (keyed by call order); call
 * `react._reset()` to start a new render. Effect callbacks are queued in
 * `react._effects` rather than invoked automatically.
 */
export function makeFakeReact() {
  let cellIdx = 0;
  const cells = [];
  const effects = [];

  function useState(initial) {
    const idx = cellIdx++;
    if (cells.length <= idx) {
      cells[idx] = typeof initial === 'function' ? initial() : initial;
    }
    const setter = (next) => {
      cells[idx] = typeof next === 'function' ? next(cells[idx]) : next;
    };
    return [cells[idx], setter];
  }

  function useEffect(fn /*, deps */) { effects.push(fn); }

  function createElement(type, props, ...children) {
    return { type, props: props ?? {}, children: children.flat() };
  }

  return {
    createElement,
    useState,
    useEffect,
    _effects: effects,
    _cells: cells,
    _reset() { cellIdx = 0; effects.length = 0; },
    _seed(values) { for (let i = 0; i < values.length; i++) cells[i] = values[i]; },
  };
}

/** Walk a fake React tree and return the first node where `pred(node)` is true. */
export function findNode(node, pred) {
  if (!node || typeof node !== 'object') return null;
  if (pred(node)) return node;
  const children = Array.isArray(node.children) ? node.children : [];
  for (const child of children) {
    const hit = findNode(child, pred);
    if (hit) return hit;
  }
  return null;
}

/** Collect every node where `pred(node)` is true. */
export function findAll(node, pred) {
  const out = [];
  function walk(n) {
    if (!n || typeof n !== 'object') return;
    if (pred(n)) out.push(n);
    const children = Array.isArray(n.children) ? n.children : [];
    for (const c of children) walk(c);
  }
  walk(node);
  return out;
}
