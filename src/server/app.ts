import express, { type Request, type Response, type NextFunction } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import type { Interpretation, TraceExplanation } from '../domain/contracts';
import { EvidenceSchema, verifyEvidence } from '../engine/evidence';
import { ApiError, DEFAULT_MODEL, explain, interpret, type ProviderOptions } from './provider';

export type ServerOptions = ProviderOptions & {
  host?: string; accessToken?: string; production?: boolean; distDirectory?: string;
  globalPerMinute?: number; clientPerMinute?: number; cacheCapacity?: number; now?: () => number;
};
export function isLoopback(host: string): boolean { return ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(host.toLowerCase()); }
const BodySchema = z.object({ source: z.string().min(1).max(30000).refine(s => !!s.trim()), requestId: z.uuid() }).strict();
const RequestSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('interpret'), body: BodySchema }),
  z.object({ kind: z.literal('explain'), body: z.object({ evidence: EvidenceSchema, requestId: z.uuid() }).strict() }),
]);
type Outcome = { ok: true; value: Interpretation | TraceExplanation } | { ok: false; error: ApiError };
type Entry = { hash: string; state: 'pending' | 'succeeded' | 'failed'; outcome: Promise<Outcome>; controller: AbortController; waiters: number };
type Window = { starts: number; calls: number };
function tokenMatches(actual: string, expected: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(actual), digest(expected));
}
export function createApp(options: ServerOptions = {}) {
  const host = options.host ?? '127.0.0.1';
  if (!isLoopback(host) && !options.accessToken) throw new Error('LOOPHOLE_ACCESS_TOKEN is required for a non-loopback bind address.');
  const app = express();
  app.disable('x-powered-by'); app.set('trust proxy', false);
  const cache = new Map<string, Entry>();
  const clients = new Map<string, Window>();
  const now = options.now ?? Date.now;
  let global: Window = { starts: now(), calls: 0 }; let active = false;
  app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); next(); });
  app.get('/api/status', (_req, res) => res.json({ configured: !!options.apiKey, model: options.model ?? DEFAULT_MODEL, requiresToken: !!options.accessToken }));
  app.post(['/api/interpret', '/api/explain'], (req, _res, next) => {
    try {
      let requestUrl: URL;
      try { requestUrl = new URL(`${req.protocol}://${req.get('host') ?? ''}`); } catch { throw new ApiError(403, 'ORIGIN_REJECTED', 'Request host is not allowed.'); }
      if (isLoopback(host) && !isLoopback(requestUrl.hostname)) throw new ApiError(403, 'ORIGIN_REJECTED', 'Request host is not allowed.');
      const origin = req.get('origin');
      if (origin) {
        let parsed: URL;
        try { parsed = new URL(origin); } catch { throw new ApiError(403, 'ORIGIN_REJECTED', 'Cross-origin interpretation is not allowed.'); }
        const devOrigin = !options.production && parsed.protocol === 'http:' && isLoopback(parsed.hostname) && parsed.port === '5173' && isLoopback(requestUrl.hostname);
        if (parsed.origin !== origin || (parsed.origin !== requestUrl.origin && !devOrigin)) throw new ApiError(403, 'ORIGIN_REJECTED', 'Cross-origin interpretation is not allowed.');
      } else if (req.get('sec-fetch-site') === 'cross-site') throw new ApiError(403, 'ORIGIN_REJECTED', 'Cross-origin interpretation is not allowed.');
      if (options.accessToken && !tokenMatches(req.get('authorization') ?? '', `Bearer ${options.accessToken}`)) throw new ApiError(401, 'UNAUTHORIZED', 'A valid LOOPHOLE access token is required.');
      if (!req.is('application/json')) throw new ApiError(415, 'JSON_REQUIRED', 'Content-Type must be application/json.');
      next();
    } catch (error) { next(error); }
  }, express.json({ limit: '128kb', strict: true, inflate: false }), async (req, res, next) => {
    const parsed = RequestSchema.safeParse({ kind: req.path === '/api/explain' ? 'explain' : 'interpret', body: req.body });
    if (!parsed.success) { next(new ApiError(400, 'INVALID_INPUT', 'Expected a bounded source or evidence payload and requestId (UUID), with no unknown fields.')); return; }
    const request = parsed.data;
    if (request.kind === 'explain') {
      try { if (!verifyEvidence(request.body.evidence).verifiedFinding) throw new Error('No finding'); }
      catch { next(new ApiError(400, 'INVALID_EVIDENCE', 'A deterministically verified finding is required. No model call was made.')); return; }
    }
    if (!options.apiKey) { next(new ApiError(503, 'AI_UNAVAILABLE', 'AI interpretation unavailable: OPENAI_API_KEY is not configured on the server.')); return; }
    const { requestId } = request.body;
    const hash = createHash('sha256').update(JSON.stringify(request.kind === 'interpret' ? { kind: request.kind, source: request.body.source } : { kind: request.kind, evidence: request.body.evidence })).digest('hex');
    let entry = cache.get(requestId);
    if (entry && entry.hash !== hash) { next(new ApiError(409, 'IDEMPOTENCY_MISMATCH', 'This request ID is already bound to a different source.')); return; }
    if (!entry) {
      if (cache.size >= (options.cacheCapacity ?? 128)) { next(new ApiError(503, 'IDEMPOTENCY_CAPACITY', 'This server session has reached its request receipt capacity. No AI call was made.')); return; }
      if (active) { next(new ApiError(429, 'AI_BUSY', 'One AI interpretation is already running. No AI call was made.')); return; }
      const time = now();
      if (time - global.starts >= 60000) global = { starts: time, calls: 0 };
      for (const [ip, window] of clients) if (time - window.starts >= 60000) clients.delete(ip);
      const client = req.socket.remoteAddress ?? 'unknown';
      const window = clients.get(client) ?? { starts: time, calls: 0 };
      if (global.calls >= (options.globalPerMinute ?? 12) || window.calls >= (options.clientPerMinute ?? 4) || (!clients.has(client) && clients.size >= 1024)) {
        next(new ApiError(429, 'RATE_LIMITED', 'AI rate limit reached. No AI call was made.')); return;
      }
      global.calls++; window.calls++; clients.set(client, window);
      active = true;
      const controller = new AbortController();
      entry = { hash, state: 'pending', controller, waiters: 0, outcome: Promise.resolve({ ok: false, error: new ApiError(500, 'INTERNAL_ERROR', 'Interpretation unavailable.') }) };
      const created = entry;
      cache.set(requestId, created);
      const operation = request.kind === 'interpret'
        ? interpret(request.body.source, controller.signal, options)
        : explain(request.body.evidence, controller.signal, options);
      created.outcome = operation.then(value => {
        created.state = 'succeeded'; return { ok: true, value } as Outcome;
      }, error => {
        created.state = 'failed'; return { ok: false, error: error instanceof ApiError ? error : new ApiError(500, 'INTERNAL_ERROR', 'Interpretation unavailable.') } as Outcome;
      }).finally(() => { active = false; });
    }
    const current = entry;
    current.waiters++;
    let attached = true;
    const detach = () => {
      if (!attached) return;
      attached = false; current.waiters--;
      if (!current.waiters && current.state === 'pending') current.controller.abort();
    };
    res.on('close', detach);
    try {
      const outcome = await current.outcome;
      if (res.destroyed) return;
      res.setHeader('Idempotency-State', current.state);
      if (outcome.ok) res.json(outcome.value); else next(outcome.error);
    } finally { res.off('close', detach); detach(); }
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'API endpoint not found.' } }));
  const dist = resolve(options.distDirectory ?? 'dist');
  if (options.production && existsSync(resolve(dist, 'index.html'))) {
    app.use(express.static(dist));
    app.get('/{*path}', (_req, res) => res.sendFile(resolve(dist, 'index.html')));
  }
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    let safe = error instanceof ApiError ? error : new ApiError(500, 'INTERNAL_ERROR', 'The server could not complete this request.');
    if (error && typeof error === 'object' && 'type' in error) {
      if (error.type === 'entity.too.large') safe = new ApiError(413, 'INPUT_TOO_LARGE', 'Request body exceeds 128 KiB.');
      else if (error.type === 'entity.parse.failed') safe = new ApiError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
      else if (error.type === 'encoding.unsupported' || error.type === 'charset.unsupported') safe = new ApiError(415, 'ENCODING_UNSUPPORTED', 'Use uncompressed UTF-8 JSON.');
    }
    if (safe.status === 429) res.setHeader('Retry-After', '60');
    if (!res.headersSent && !res.destroyed) res.status(safe.status).json({ error: { code: safe.code, message: safe.message } });
  });
  return app;
}
