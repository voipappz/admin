const portal = (process.env.PORTAL_URL || 'http://127.0.0.1:4001').replace(/\/$/, '');

function token() {
  const direct = (process.env.TOKEN || '').trim();
  if (direct) return direct;

  const auth = (process.env.AUTH || '').trim();
  if (!auth) throw new Error('set TOKEN=<jwt> or AUTH=<localStorage.auth JSON>');

  const parsed = JSON.parse(auth);
  const value = parsed.access || parsed.token;
  if (!value) throw new Error('AUTH contains no access/token field');
  return value;
}

function value(flag, fallback) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function endpoint(command) {
  const params = new URLSearchParams();
  const limit = value('--limit', '');
  if (limit) params.set('limit', limit);

  switch (command) {
    case 'recent': {
      const src = value('--src', '');
      if (src) params.set('src', src);
      return `/api/events${params.size ? `?${params}` : ''}`;
    }
    case 'timeline': {
      const sid = value('--sid', '');
      if (!sid) throw new Error('timeline requires --sid');
      params.set('sid', sid);
      return `/api/events/timeline?${params}`;
    }
    case 'search': {
      const query = value('--query', '');
      if (!query) throw new Error('search requires --query');
      params.set('q', query);
      return `/api/events/search?${params}`;
    }
    case 'stats':
      return '/api/events/stats';
    default:
      throw new Error('usage: events.mjs recent|timeline|search|stats [--limit N] [--src S] [--sid ID] [--query Q]');
  }
}

try {
  const path = endpoint(process.argv[2] || 'recent');
  const response = await fetch(`${portal}${path}`, {
    headers: { authorization: `Bearer ${token()}`, accept: 'application/json' },
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`GET ${path} -> ${response.status}: ${body.slice(0, 500)}`);
  console.log(JSON.stringify(JSON.parse(body), null, 2));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
