const TTL_MS = 60_000;
const MAX_ENTRIES = 300;

const store = new Map();

function prune() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now - entry.createdAt > TTL_MS) store.delete(key);
  }
  if (store.size > MAX_ENTRIES) {
    const excess = store.size - MAX_ENTRIES;
    let removed = 0;
    for (const key of store.keys()) {
      store.delete(key);
      if (++removed >= excess) break;
    }
  }
}

/** Cache em memória simples: chave = rota + query string. TTL de 60 s. */
export function cacheMiddleware(req, res, next) {
  if (req.method !== 'GET' || req.path === '/health') {
    return next();
  }

  const key = req.originalUrl;
  const entry = store.get(key);
  if (entry && Date.now() - entry.createdAt <= TTL_MS) {
    res.set('X-Cache', 'HIT');
    return res.json(entry.body);
  }

  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode < 400) {
      store.set(key, { body, createdAt: Date.now() });
      prune();
      res.set('X-Cache', 'MISS');
    }
    return originalJson(body);
  };

  return next();
}

export function clearCache() {
  store.clear();
}

export function cacheStats() {
  return { entries: store.size, ttlSeconds: TTL_MS / 1000 };
}
