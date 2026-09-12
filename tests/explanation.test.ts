import { afterEach, expect, it, vi } from 'vitest';
import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { explain } from '../src/server/provider';
import { createApp } from '../src/server/app';
import { DEFAULT_BUDGET, DEFAULT_OBJECTIVE } from '../src/domain/model';
import { LANTERN } from '../src/samples';
import { search } from '../src/engine/search';
const evidence = () => ({ schemaVersion: 1, model: LANTERN, reviewed: true, result: search(LANTERN, DEFAULT_OBJECTIVE, DEFAULT_BUDGET, { reviewed: true }), createdAt: new Date().toISOString() });
const narrative = { explanation: 'The grant restores the spent seal. Resale closes the resource cycle.', citedSteps: [1, 3, 4], suggestedChanges: ['Reduce the maker grant to 1.00 crowns.'] };
const mocked = (output: unknown = narrative) => vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(output) }] }], usage: { input_tokens: 10, output_tokens: 20 } })));
const servers: Server[] = [];
afterEach(async () => { await Promise.all(servers.splice(0).map(s => new Promise<void>(resolve => { s.closeAllConnections(); s.close(() => resolve()); }))); });
it('explains only a freshly verified trace and keeps the verdict outside generated narrative', async () => {
  const provider = mocked(); const answer = await explain(evidence(), new AbortController().signal, { apiKey: 'secret', fetch: provider });
  expect(answer.explanation).toBe(narrative.explanation); expect(answer.usage!.estimatedCostUsd).toBe('0.001100');
  const body = JSON.parse(provider.mock.calls[0]![1]!.body as string); const payload = JSON.parse(body.input[1].content);
  expect(payload.finding.certificate.kind).toBe('repeatable-profit'); expect(body.input[0].content).toContain('Never override the engine certificate');
  expect(payload.apiKey).toBeUndefined();
});
it('rejects tampered evidence before any model call', async () => {
  const e = evidence(); e.result.finding!.gain = '999999'; const provider = mocked();
  await expect(explain(e, new AbortController().signal, { apiKey: 'secret', fetch: provider })).rejects.toMatchObject({ code: 'INVALID_EVIDENCE' }); expect(provider).not.toHaveBeenCalled();
});
it('rejects invented trace-step references and extra verdict fields', async () => {
  for (const output of [{ ...narrative, citedSteps: [40] }, { ...narrative, safe: true }]) await expect(explain(evidence(), new AbortController().signal, { apiKey: 'secret', fetch: mocked(output) })).rejects.toMatchObject({ code: 'INVALID_PROVIDER_RESPONSE' });
});
it('shares authentication and idempotency admission with interpretation', async () => {
  const provider = mocked(); const server = createApp({ apiKey: 'secret', accessToken: 'gate', fetch: provider }).listen(0, '127.0.0.1'); servers.push(server); await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('No server address');
  const url = `http://127.0.0.1:${address.port}/api/explain`; const body = JSON.stringify({ evidence: evidence(), requestId: randomUUID() });
  const post = (token: string) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token }, body });
  expect((await post('')).status).toBe(401); expect((await post('Bearer gate')).status).toBe(200); expect((await post('Bearer gate')).status).toBe(200); expect(provider).toHaveBeenCalledTimes(1);
});
