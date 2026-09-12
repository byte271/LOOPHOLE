import { z } from "zod";
import {
  BudgetSchema,
  ENGINE_VERSION,
  ModelSchema,
  ObjectiveSchema,
  canonical,
  modelVersion,
  validateModel,
} from "../domain/model";
import type { Budget, Model, Objective } from "../domain/model";
import type { Evidence, Interpretation } from "../domain/contracts";
import { EvidenceSchema, verifyEvidence } from "../engine/evidence";

export const STORAGE_KEY = "loophole.workspace.v1";
const MAX_DRAFT = 450_000;
export const MAX_FRAGMENT = 100_000;
const evidenceSchema: z.ZodType<Evidence> = EvidenceSchema;
export const resultSchema = EvidenceSchema.shape.result;
export const progressSchema = resultSchema.shape.progress;
export type VersionEntry = {
  model: Model;
  reviewed: boolean;
  evidence: Evidence | null;
  createdAt: string;
};
const versionSchema = z
  .object({
    model: ModelSchema,
    reviewed: z.boolean(),
    evidence: evidenceSchema.nullable(),
    createdAt: z.string().datetime(),
  })
  .strict();
const draftSchema = z
  .object({
    schemaVersion: z.literal(1),
    model: ModelSchema,
    reviewed: z.boolean(),
    objective: ObjectiveSchema,
    budget: BudgetSchema,
    sourceDraft: z.string().max(30000),
    jsonDraft: z.string().max(120000),
    evidence: evidenceSchema.nullable(),
    history: z.array(versionSchema).max(5),
    savedAt: z.string().datetime(),
  })
  .strict();
export type Draft = z.infer<typeof draftSchema>;
export function validateEvidence(input: unknown): Evidence {
  return verifyEvidence(input).evidence;
}
export function loadDraft(): Draft | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  if (new TextEncoder().encode(raw).byteLength > MAX_DRAFT)
    throw new Error(
      "Local draft exceeds the 450 KB safety limit. It was not loaded.",
    );
  const d = draftSchema.parse(JSON.parse(raw));
  d.model = validateModel(d.model);
  d.history = d.history.map((v) => {
    const model = validateModel(v.model);
    const evidence = v.evidence ? validateEvidence(v.evidence) : null;
    if (
      evidence &&
      (modelVersion(model) !== evidence.result.modelVersion ||
        evidence.reviewed !== v.reviewed)
    )
      throw new Error(
        "A historical result is not pinned to its recorded version.",
      );
    return { ...v, model, evidence };
  });
  if (d.evidence) {
    d.evidence = validateEvidence(d.evidence);
    if (
      d.evidence.result.modelVersion !== modelVersion(d.model) ||
      d.evidence.reviewed !== d.reviewed ||
      canonical(d.evidence.result.objective) !== canonical(d.objective) ||
      canonical(d.evidence.result.budget) !== canonical(d.budget)
    )
      throw new Error(
        "Draft evidence is pinned to different model or search settings.",
      );
  }
  return d;
}
export function saveDraft(draft: Draft) {
  const raw = JSON.stringify(draftSchema.parse(draft));
  if (new TextEncoder().encode(raw).byteLength > MAX_DRAFT)
    throw new Error(
      "Draft exceeds the 450 KB local limit. Export evidence and clear older history before saving.",
    );
  localStorage.setItem(STORAGE_KEY, raw);
}
const challengeSchema = z
  .object({
    schemaVersion: z.literal(1),
    kind: z.literal("loophole-challenge"),
    model: ModelSchema,
    objective: ObjectiveSchema,
    budget: BudgetSchema,
    engineVersion: z.literal(ENGINE_VERSION),
    reviewed: z.literal(false),
  })
  .strict();
export type Challenge = z.infer<typeof challengeSchema>;
export function readChallenge(): Challenge | null {
  if (!location.hash) return null;
  if (!location.hash.startsWith("#challenge="))
    throw new Error(
      "Unrecognized shared snapshot fragment. Your private draft was not replaced.",
    );
  if (location.hash.length > MAX_FRAGMENT)
    throw new Error("Shared snapshot exceeds the 100 KB URL safety limit.");
  const raw = location.hash.slice(11);
  if (!/^[A-Za-z0-9_-]+$/.test(raw))
    throw new Error("Shared snapshot encoding is invalid.");
  const bytes = Uint8Array.from(
    atob(raw.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0),
  );
  const c = challengeSchema.parse(
    JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
  );
  c.model = validateModel(c.model);
  return c;
}
export function challengeURL(
  model: Model,
  objective: Objective,
  budget: Budget,
): string {
  const c = challengeSchema.parse({
    schemaVersion: 1,
    kind: "loophole-challenge",
    model,
    objective,
    budget,
    engineVersion: ENGINE_VERSION,
    reviewed: false,
  });
  const bytes = new TextEncoder().encode(JSON.stringify(c));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const fragment =
    "#challenge=" +
    btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  if (fragment.length > MAX_FRAGMENT)
    throw new Error(
      "This model is too large for a share URL. Export its evidence instead.",
    );
  return location.origin + location.pathname + fragment;
}
export const interpretationSchema: z.ZodType<Interpretation> = z
  .object({
    model: ModelSchema.nullable(),
    ambiguities: z.array(z.string().max(2000)).max(24),
    strategies: z
      .array(
        z
          .object({
            title: z.string(),
            actionIds: z.array(z.string()).max(40),
            rationale: z.string(),
          })
          .strict(),
      )
      .max(24),
    explanation: z.string(),
    suggestedChanges: z.array(z.string()),
    usage: z
      .object({
        inputTokens: z.number(),
        outputTokens: z.number(),
        estimatedCostUsd: z.string(),
        model: z.string(),
      })
      .strict()
      .nullable(),
  })
  .strict();
export function errorMessage(error: unknown): string {
  if (error instanceof z.ZodError)
    return error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join(".") || "Input"}: ${i.message}`)
      .join(" · ");
  return error instanceof Error ? error.message : String(error);
}
export function downloadEvidence(evidence: Evidence) {
  const blob = new Blob([JSON.stringify(validateEvidence(evidence), null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `loophole-${evidence.result.modelVersion.slice(0, 11)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
