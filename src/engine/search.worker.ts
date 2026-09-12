/// <reference lib="webworker" />
import { z } from 'zod';
import { BudgetSchema, ModelSchema, ObjectiveSchema } from '../domain/model';
import type { WorkerResponse } from '../domain/contracts';
import { search } from './search';
const RequestSchema = z.object({ runId: z.string().max(100), model: ModelSchema, objective: ObjectiveSchema, budget: BudgetSchema, reviewed: z.boolean(), candidates: z.array(z.array(z.string().max(40)).max(40)).max(12).optional() }).strict();
self.onmessage = (event: MessageEvent<unknown>) => {
  let runId = '';
  const post = (message: WorkerResponse) => self.postMessage(message);
  try {
    const request = RequestSchema.parse(event.data); runId = request.runId;
    const result = search(request.model, request.objective, request.budget, { reviewed: request.reviewed, candidates: request.candidates, onProgress: progress => post({ runId, type: 'progress', progress }) });
    post({ runId, type: 'result', result });
  } catch (error) { post({ runId, type: 'error', message: error instanceof Error ? error.message : 'Analysis failed.' }); }
};
