// Minimal Express stand-in so route handlers can be exercised without installing express
type Handler = (req: any, res: any, next?: any) => any;
interface Route { method: string; re: RegExp; keys: string[]; handler: Handler }

export function makeApp() {
  const routes: Route[] = [];
  const middleware: { prefix: string; fn: Handler }[] = [];
  const add = (method: string) => (path: string, handler: Handler) => {
    const keys: string[] = [];
    const re = new RegExp('^' + path.replace(/:([A-Za-z_]+)/g, (_m, k) => { keys.push(k); return '([^/]+)'; }) + '$');
    routes.push({ method, re, keys, handler });
  };
  const app: any = {
    get: add('GET'), post: add('POST'), put: add('PUT'), delete: add('DELETE'),
    use: (prefix: string, fn: Handler) => middleware.push({ prefix, fn }),
  };
  async function call(method: string, url: string, body: any = {}, token: string | null = null) {
    const [rawPath, qs] = url.split('?');
    const query: any = Object.fromEntries(new URLSearchParams(qs || ''));
    const req: any = { method, originalUrl: url, query, body, headers: token ? { authorization: `Bearer ${token}` } : {}, params: {} };
    let status = 200; let payload: any = null; let sent = false;
    const res: any = {
      headersSent: false,
      status(c: number) { status = c; return res; },
      json(p: any) { payload = p; sent = true; res.headersSent = true; return res; },
    };
    for (const m of middleware) {
      if (rawPath.startsWith(m.prefix)) {
        req.path = rawPath.slice(m.prefix.length) || '/';
        let proceed = false;
        await m.fn(req, res, () => { proceed = true; });
        if (!proceed) return { status, ...payload };
      }
    }
    const route = routes.find((r) => r.method === method && r.re.test(rawPath));
    if (!route) return { status: 404, success: false, message: 'NO_ROUTE ' + method + ' ' + rawPath };
    const m = rawPath.match(route.re)!;
    route.keys.forEach((k, i) => { req.params[k] = decodeURIComponent(m[i + 1]); });
    await route.handler(req, res);
    return { status, ...payload };
  }
  return { app, call };
}
