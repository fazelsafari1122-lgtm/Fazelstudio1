import { db } from '../db.ts';
import { Ctx } from './util.ts';
import { registerFamilyRoutes } from './families.ts';
import { registerSchedulingRoutes, processDeposits } from './scheduling.ts';
import { registerProjectRoutes } from './projects.ts';
import { registerFollowupRoutes } from './followups.ts';
import { registerFinanceRoutes } from './finance.ts';
import { registerSmsRoutes } from './sms.ts';
import { registerReportRoutes } from './reports.ts';
import { registerSystemRoutes, permissionsFor } from './system.ts';
import { processQueue } from '../smsService.ts';

const PUBLIC_PATHS = [/^\/auth\/login$/, /^\/public\//];
const FINANCE_PATHS = [/^\/payments/, /^\/invoices/, /^\/accounting/, /^\/cheques/, /^\/products/, /^\/team\/payments/];
const SETTINGS_PATHS = [/^\/settings/, /^\/lookups/, /^\/packages/, /^\/branches/, /^\/halls/, /^\/project-stages/, /^\/working-hours/, /^\/holidays/, /^\/services/, /^\/sms\/templates/];
const USER_PATHS = [/^\/users/, /^\/audit-logs/];

export function userFromToken(token: string | null) {
  if (!token) return null;
  const row = db.prepare(`
    SELECT u.id, u.username, u.full_name, u.role, u.phone, u.email, u.status
    FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND u.status = 'active'
  `).get(token) as any;
  return row || null;
}

export function tokenFromReq(req: any): string | null {
  const header = req.headers?.authorization;
  if (!header) return null;
  return String(header).replace(/^Bearer\s+/i, '').trim() || null;
}

/** Returns an error message if the user may not call this route, otherwise null. */
export function permissionError(perms: string[], method: string, path: string): string | null {
  if (perms.includes('all')) return null;
  const need = (p: string, msg: string) => (perms.includes(p) ? null : msg);
  const denied = 'شما دسترسی لازم برای این عملیات را ندارید.';
  if (/^\/auth\//.test(path)) return null;
  if (method === 'GET') {
    if (/^\/reports/.test(path)) return need('reports', denied);
    if (USER_PATHS.some((r) => r.test(path))) return need('users', denied);
    if (/^\/accounting/.test(path) || /^\/team\/payments/.test(path)) return need('finance', denied);
    return need('view', denied);
  }
  if (USER_PATHS.some((r) => r.test(path))) return need('users', denied);
  if (SETTINGS_PATHS.some((r) => r.test(path))) return need('settings', denied);
  if (FINANCE_PATHS.some((r) => r.test(path))) return need('finance', denied);
  if (method === 'POST') return need('create', denied);
  if (method === 'DELETE') return need('delete', denied);
  return need('edit', denied);
}

export function registerExtraRoutes(app: any, ctx: Ctx) {
  app.use('/api', (req: any, res: any, next: any) => {
    const path = req.path as string;
    if (PUBLIC_PATHS.some((r) => r.test(path))) return next();
    const user = userFromToken(tokenFromReq(req));
    if (!user) return res.status(401).json({ success: false, message: 'نشست شما منقضی شده است. لطفاً دوباره وارد شوید.' });
    req.user = user;
    const err = permissionError(permissionsFor(user.role), req.method, path);
    if (err) return res.status(403).json({ success: false, message: err });
    return next();
  });

  registerFamilyRoutes(app, ctx);
  registerSchedulingRoutes(app, ctx);
  registerProjectRoutes(app, ctx);
  registerFollowupRoutes(app, ctx);
  registerFinanceRoutes(app, ctx);
  registerSmsRoutes(app, ctx);
  registerReportRoutes(app, ctx);
  registerSystemRoutes(app, ctx);
}

/** Background jobs: send due SMS and enforce deposit deadlines. */
export function startBackgroundJobs() {
  const tick = async () => {
    try { await processDeposits(); await processQueue(); } catch (e) { console.error('Background job error:', e); }
  };
  const t = setInterval(tick, 30_000);
  (t as any).unref?.();
  return tick;
}
