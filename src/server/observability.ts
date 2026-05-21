/**
 * Request observability — wraps an API route handler with structured logging.
 * Captures method, path, status, duration, presented API key prefix, IP.
 * In production these lines forward to Datadog/Axiom; in dev they print to
 * the terminal so you can watch traffic land.
 *
 * Usage:
 *   export const GET = withRequestLog(async (req) => { ... });
 */

type Handler<Ctx = unknown> = (req: Request, ctx: Ctx) => Promise<Response> | Response;

export function withRequestLog<Ctx>(handler: Handler<Ctx>): Handler<Ctx> {
  return async (req, ctx) => {
    const started = Date.now();
    const method = req.method;
    const url = new URL(req.url);
    const path = url.pathname;
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "?";
    const auth = req.headers.get("authorization");
    const keyPrefix =
      auth?.startsWith("Bearer ") && auth.length > 20 ? auth.slice(7, 19) : "anon";

    let res: Response;
    let errored = false;
    try {
      res = await handler(req, ctx);
    } catch (err) {
      errored = true;
      console.error(`[api] ${method} ${path} threw:`, err);
      throw err;
    } finally {
      const ms = Date.now() - started;
      const status = errored ? 500 : (res! && res!.status) || 0;
      const tone =
        status >= 500 ? "✗" : status >= 400 ? "!" : status >= 300 ? "→" : "✓";
      console.log(
        `[api] ${tone} ${method} ${path} · ${status} · ${ms}ms · ${keyPrefix} · ${ip}`,
      );
    }
    return res!;
  };
}

/**
 * Same idea, but for Next.js dynamic routes that receive a `{ params }`
 * second argument. Type-erased to keep the signature simple.
 */
export function withRequestLogDynamic<P>(
  handler: (req: Request, args: { params: P }) => Promise<Response>,
): (req: Request, args: { params: P }) => Promise<Response> {
  return async (req, args) => {
    const started = Date.now();
    const method = req.method;
    const url = new URL(req.url);
    const path = url.pathname;

    let res: Response;
    let errored = false;
    try {
      res = await handler(req, args);
    } catch (err) {
      errored = true;
      console.error(`[api] ${method} ${path} threw:`, err);
      throw err;
    } finally {
      const ms = Date.now() - started;
      const status = errored ? 500 : (res! && res!.status) || 0;
      const tone =
        status >= 500 ? "✗" : status >= 400 ? "!" : status >= 300 ? "→" : "✓";
      console.log(`[api] ${tone} ${method} ${path} · ${status} · ${ms}ms`);
    }
    return res!;
  };
}
