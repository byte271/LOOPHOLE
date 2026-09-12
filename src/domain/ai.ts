import { z } from 'zod';
export const UsageSchema = z.object({ inputTokens: z.number().int().nonnegative(), outputTokens: z.number().int().nonnegative(), estimatedCostUsd: z.string().regex(/^\d+\.\d{6}$/), model: z.string().max(100) }).strict();
export const ExplanationContentSchema = z.object({ explanation: z.string().min(1).max(6000), suggestedChanges: z.array(z.string().min(1).max(2000)).max(8), citedSteps: z.array(z.number().int().min(1).max(40)).max(40) }).strict();
export const TraceExplanationSchema = ExplanationContentSchema.extend({ usage: UsageSchema.nullable() }).strict();
