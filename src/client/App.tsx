import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Braces,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Coins,
  Copy,
  Download,
  FileCheck2,
  GitBranch,
  Github,
  History,
  Info,
  KeyRound,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Share2,
  ShieldCheck,
  SkipForward,
  Sparkles,
  Square,
  Terminal,
  TriangleAlert,
  X,
  Zap,
} from "lucide-react";
import {
  BudgetSchema,
  DEFAULT_BUDGET,
  DEFAULT_OBJECTIVE,
  ENGINE_VERSION,
  ObjectiveSchema,
  canonical,
  formatMoney,
  modelVersion,
  validateModel,
} from "../domain/model";
import type { Budget, Model, Objective } from "../domain/model";
import type {
  Evidence,
  Interpretation,
  SearchProgress,
  SearchRequest,
  SearchResult,
  WorkerResponse,
} from "../domain/contracts";
import { replay, verifyTrace } from "../engine/execute";
import { SAMPLES } from "../samples";
import { TraceNarrative } from "./TraceNarrative";
import { interpret as interpretDirect } from "../server/provider";
import { ModelSettings, loadModelSettings } from "./ModelSettings";
import { EconomyMap } from "./EconomyMap";
import {
  STORAGE_KEY,
  challengeURL,
  downloadEvidence,
  errorMessage,
  interpretationSchema,
  loadDraft,
  progressSchema,
  readChallenge,
  resultSchema,
  saveDraft,
  validateEvidence,
} from "./storage";
import type { Draft, VersionEntry } from "./storage";

const zero: SearchProgress = {
  explored: 0,
  discovered: 0,
  frontier: 0,
  depth: 0,
  elapsedMs: 0,
};
function bootstrap() {
  let error = "";
  try {
    const challenge = readChallenge();
    if (challenge)
      return {
        model: challenge.model,
        objective: challenge.objective,
        budget: challenge.budget,
        reviewed: false,
        shared: true,
        draft: null,
        error,
      };
  } catch (e) {
    error = `Shared snapshot not loaded: ${errorMessage(e)}`;
  }
  try {
    const draft = loadDraft();
    if (draft)
      return {
        model: draft.model,
        objective: draft.objective,
        budget: draft.budget,
        reviewed: draft.reviewed,
        shared: false,
        draft,
        error,
      };
  } catch (e) {
    error += `${error ? " " : ""}Local recovery failed: ${errorMessage(e)} The original stored draft has been kept.`;
  }
  return {
    model: validateModel(SAMPLES[0]!.model),
    objective: DEFAULT_OBJECTIVE,
    budget: DEFAULT_BUDGET,
    reviewed: false,
    shared: false,
    draft: null,
    error,
  };
}
function Dialog({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    node
      ?.querySelector<HTMLElement>("button, input, textarea, select")
      ?.focus();
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && node) {
        const els = Array.from(
          node.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]',
          ),
        );
        const first = els[0],
          last = els.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <h2>{title}</h2>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
export default function App() {
  const [boot] = useState(bootstrap);
  const [model, setModel] = useState<Model>(boot.model);
  const [objective, setObjective] = useState<Objective>(boot.objective);
  const [budget, setBudget] = useState<Budget>(boot.budget);
  const [reviewed, setReviewed] = useState(boot.reviewed);
  const [shared, setShared] = useState(boot.shared);
  const [sourceDraft, setSourceDraft] = useState(
    boot.draft?.sourceDraft ?? boot.model.source,
  );
  const [jsonDraft, setJsonDraft] = useState(
    boot.draft?.jsonDraft ?? JSON.stringify(boot.model, null, 2),
  );
  const [evidence, setEvidence] = useState<Evidence | null>(
    boot.draft?.evidence ?? null,
  );
  const [history, setHistory] = useState<VersionEntry[]>(
    boot.draft?.history ?? [],
  );
  const [error, setError] = useState(boot.error);
  const [recoveryBlocked, setRecoveryBlocked] = useState(!!boot.error);
  const [notice, setNotice] = useState("");
  const [saved, setSaved] = useState(
    boot.draft
      ? `Recovered ${new Date(boot.draft.savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
      : "Local draft",
  );
  const [tab, setTab] = useState<"rules" | "model">("rules");
  const [editing, setEditing] = useState(false);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [modal, setModal] = useState<
    "share" | "history" | "help" | "initial" | null
  >(null);
  const closeModal = useCallback(() => setModal(null), []);
  const [shareLink, setShareLink] = useState("");
  const [shareConfirmed, setShareConfirmed] = useState(false);
  const [comparison, setComparison] = useState<{
    ok: boolean;
    text: string;
    details: string;
  } | null>(null);
  const [initialText, setInitialText] = useState(
    JSON.stringify(model.initial, null, 2),
  );
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<SearchProgress>(zero);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [api, setApi] = useState<{
    configured: boolean;
    model: string;
    requiresToken: boolean;
  } | null>(null);
  const [modelSettings, setModelSettings] = useState(loadModelSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const aiConfigured = !!modelSettings.apiKey || !!api?.configured;
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const [token, setToken] = useState("");
  const [interpreting, setInterpreting] = useState(false);
  const [interpretation, setInterpretation] = useState<Interpretation | null>(
    null,
  );
  const [apiSettings, setApiSettings] = useState(false);
  const worker = useRef<Worker | null>(null);
  const watchdog = useRef<number | undefined>(undefined);
  function clearWatchdog() { window.clearTimeout(watchdog.current); watchdog.current = undefined; }
  const run = useRef<{
    id: string;
    model: Model;
    objective: Objective;
    budget: Budget;
    reviewed: boolean;
  } | null>(null);
  const progressRef = useRef<SearchProgress>(zero);
  const interpretAbort = useRef<AbortController | null>(null);
  const version = useMemo(() => modelVersion(model), [model]);
  const trace = evidence?.result.finding?.trace;
  const currentStep = cursor > 0 ? trace?.steps[cursor - 1] : undefined;
  const currentState = currentStep?.after ?? trace?.initial ?? model.initial;
  const inspected = model.actions.find(
    (a) => a.id === (selectedAction ?? currentStep?.actionId),
  );
  const activeRules = inspected?.ruleIds ?? [];
  const assumptions = model.assumptions;
  const result = evidence?.result;
  const finding = result?.finding;
  const money = (value: string) => formatMoney(value, model.currency.decimals);
  const dirty =
    sourceDraft !== model.source ||
    jsonDraft !== JSON.stringify(model, null, 2);

  useEffect(() => {
    const list = document.querySelector<HTMLElement>(".rule-list");
    const item = list?.querySelector<HTMLElement>(".rule-card.highlighted");
    if (!list || !item) return;
    const top =
      item.getBoundingClientRect().top - list.getBoundingClientRect().top;
    if (top < 0 || top + item.offsetHeight > list.clientHeight)
      list.scrollTop += top;
  }, [inspected?.id, tab, editing]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/status", { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error("Interpretation server unavailable");
        const s: unknown = await r.json();
        if (
          !s ||
          typeof s !== "object" ||
          !("configured" in s) ||
          typeof s.configured !== "boolean" ||
          !("requiresToken" in s) ||
          typeof s.requiresToken !== "boolean" ||
          !("model" in s) ||
          typeof s.model !== "string"
        )
          throw new Error("Invalid server status");
        setApi({
          configured: s.configured,
          requiresToken: s.requiresToken,
          model: s.model,
        });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setApi({
            configured: false,
            model: "Unavailable",
            requiresToken: false,
          });
      });
    return () => controller.abort();
  }, []);
  useEffect(
    () => () => {
      worker.current?.terminate();
      clearWatchdog();
      interpretAbort.current?.abort();
    },
    [],
  );
  useEffect(() => {
    if (!playing || !trace) return;
    if (cursor >= trace.steps.length) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => {
      setCursor((c) => c + 1);
      setSelectedAction(null);
    }, 1050);
    return () => clearTimeout(timer);
  }, [playing, cursor, trace]);
  const currentDraft = useCallback(
    (): Draft => ({
      schemaVersion: 1,
      model,
      reviewed,
      objective,
      budget,
      sourceDraft,
      jsonDraft,
      evidence,
      history,
      savedAt: new Date().toISOString(),
    }),
    [
      model,
      reviewed,
      objective,
      budget,
      sourceDraft,
      jsonDraft,
      evidence,
      history,
    ],
  );
  const persist = useCallback(
    (explicit = false) => {
      if (shared || (recoveryBlocked && !explicit)) return;
      try {
        saveDraft(currentDraft());
        setSaved(
          `Saved ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
        );
        if (explicit) {
          setRecoveryBlocked(false);
          setNotice("Private draft saved on this browser. Nothing was shared.");
        }
      } catch (e) {
        setSaved("Not saved");
        setError(`Local save failed: ${errorMessage(e)}`);
      }
    },
    [currentDraft, shared, recoveryBlocked],
  );
  useEffect(() => {
    if (shared || recoveryBlocked) return;
    setSaved("Saving…");
    const t = setTimeout(() => persist(), 700);
    return () => clearTimeout(t);
  }, [persist, shared, recoveryBlocked]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 6500);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    const navigateSnapshot = () => {
      if (!shared && !recoveryBlocked) {
        try { saveDraft(currentDraft()); }
        catch (e) { setError(`Save failed before opening the shared snapshot: ${errorMessage(e)}`); return; }
      }
      window.location.reload();
    };
    window.addEventListener('hashchange', navigateSnapshot);
    return () => window.removeEventListener('hashchange', navigateSnapshot);
  }, [currentDraft, shared, recoveryBlocked]);
  function resetRun() {
    worker.current?.terminate();
    worker.current = null;
    clearWatchdog();
    run.current = null;
    setRunning(false);
    setPlaying(false);
    setCursor(0);
    setSelectedAction(null);
    setProgress(zero);
    progressRef.current = zero;
  }
  function archive() {
    setHistory((h) =>
      [
        { model, reviewed, evidence, createdAt: new Date().toISOString() },
        ...h.filter((v) => modelVersion(v.model) !== version),
      ].slice(0, 5),
    );
  }
  function commitModel(
    input: unknown,
    options?: { preserveInterpretation?: boolean },
  ) {
    if (shared) return;
    const next = validateModel(input);
    if (modelVersion(next) !== version) archive();
    resetRun();
    interpretAbort.current?.abort();
    setInterpreting(false);
    setModel(next);
    setSourceDraft(next.source);
    setJsonDraft(JSON.stringify(next, null, 2));
    setReviewed(false);
    setEvidence(null);
    setComparison(null);
    setError("");
    setShareLink("");
    if (!options?.preserveInterpretation) setInterpretation(null);
    setNotice("New model version. Review its rules, then run a fresh search.");
  }
  function updateObjective(next: Objective) {
    if (shared) return;
    resetRun();
    setObjective(next);
    setEvidence(null);
  }
  function updateBudget(next: Budget) {
    if (shared) return;
    resetRun();
    setBudget(next);
    setEvidence(null);
  }
  function updateReview(next: boolean) {
    if (shared) return;
    resetRun();
    setReviewed(next);
    setEvidence(null);
  }
  function cancelSearch() {
    const pinned = run.current;
    if (!pinned) return;
    const cancelled: SearchResult = {
      status: "cancelled",
      finding: null,
      progress: progressRef.current,
      budget: pinned.budget,
      objective: pinned.objective,
      modelVersion: modelVersion(pinned.model),
      engineVersion: ENGINE_VERSION,
      message:
        "Search cancelled by you. Counts reflect the last worker update; no conclusion was reached.",
      depthBoundComplete: false,
    };
    worker.current?.terminate();
    worker.current = null;
    clearWatchdog();
    run.current = null;
    setRunning(false);
    setEvidence({
      schemaVersion: 1,
      model: pinned.model,
      reviewed: pinned.reviewed,
      result: cancelled,
      createdAt: new Date().toISOString(),
    });
  }
  function startSearch() {
    try {
      ObjectiveSchema.parse(objective);
      BudgetSchema.parse(budget);
      validateModel(model);
      if (dirty)
        throw new Error(
          "Apply or discard your source/model edits before searching. Search always uses the pinned, validated model.",
        );
      resetRun();
      setEvidence(null);
      setError("");
      const request: SearchRequest = {
        runId: crypto.randomUUID(),
        model,
        objective,
        budget,
        reviewed,
        candidates: interpretation?.strategies.map((s) => s.actionIds),
      };
      const pinned = { id: request.runId, model, objective, budget, reviewed };
      run.current = pinned;
      const w = new Worker(
        new URL("../engine/search.worker.ts", import.meta.url),
        { type: "module" },
      );
      worker.current = w;
      setRunning(true);
      const fail = (message: string, status: 'failed' | 'time-limit' = 'failed') => {
        if (run.current?.id !== pinned.id) return;
        setError(message);
        w.terminate();
        worker.current = null;
    clearWatchdog();
        run.current = null;
        setRunning(false);
        setEvidence({
          schemaVersion: 1,
          model: pinned.model,
          reviewed: pinned.reviewed,
          createdAt: new Date().toISOString(),
          result: {
            status,
            finding: null,
            progress: progressRef.current,
            budget: pinned.budget,
            objective: pinned.objective,
            modelVersion: modelVersion(pinned.model),
            engineVersion: ENGINE_VERSION,
            message,
            depthBoundComplete: false,
          },
        });
      };
      w.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const message = event.data;
        if (run.current?.id !== pinned.id || message.runId !== pinned.id)
          return;
        try {
          if (message.type === "progress") {
            const p = progressSchema.parse(message.progress);
            progressRef.current = p;
            setProgress(p);
          } else if (message.type === "error") fail(message.message);
          else if (message.type === "result") {
            const r = resultSchema.parse(message.result);
            if (
              r.modelVersion !== modelVersion(pinned.model) ||
              canonical(r.objective) !== canonical(pinned.objective) ||
              canonical(r.budget) !== canonical(pinned.budget)
            )
              throw new Error(
                "Worker result did not match the pinned request.",
              );
            const next = validateEvidence({
              schemaVersion: 1,
              model: pinned.model,
              reviewed: pinned.reviewed,
              result: r,
              createdAt: new Date().toISOString(),
            });
            if (next.result.finding)
              verifyTrace(pinned.model, next.result.finding.trace);
            setEvidence(next);
            setProgress(r.progress);
            setCursor(0);
            setRunning(false);
            w.terminate();
            worker.current = null;
    clearWatchdog();
            run.current = null;
          }
        } catch (e) {
          fail(`Result rejected: ${errorMessage(e)}`);
        }
      };
      w.onerror = (e) => {
        e.preventDefault();
        fail(
          `Worker failed: ${e.message || "Unable to run deterministic search."}`,
        );
      };
      watchdog.current = window.setTimeout(() => fail('Worker stopped by the wall-clock watchdog. The analysis did not finish.', progressRef.current.discovered > 0 ? 'time-limit' : 'failed'), budget.maxMilliseconds + 2000);
      w.postMessage(request);
    } catch (e) {
      resetRun();
      setError(errorMessage(e));
    }
  }
  async function interpret(e: FormEvent) {
    e.preventDefault();
    if (shared) return;
    const controller = new AbortController();
    interpretAbort.current?.abort();
    interpretAbort.current = controller;
    setInterpreting(true);
    setError("");
    try {
      if (!sourceDraft.trim()) throw new Error("Add the economy rules first.");
      if (!modelSettings.apiKey && api?.requiresToken && !token)
        throw new Error(
          "This server requires an access token. Enter it in connection settings.",
        );
      let payload: unknown;
      if (modelSettings.apiKey) {
        payload = await interpretDirect(sourceDraft, controller.signal, modelSettings);
      } else {
      const response = await fetch("/api/interpret", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          source: sourceDraft,
          requestId: crypto.randomUUID(),
        }),
      });
      payload = await response.json().catch(() => null);
      if (!response.ok) {
        const problem =
          payload && typeof payload === "object" && "error" in payload
            ? payload.error
            : null;
        const message =
          typeof problem === "string"
            ? problem
            : problem &&
                typeof problem === "object" &&
                "message" in problem &&
                typeof problem.message === "string"
              ? problem.message
              : `Server returned ${response.status}`;
        throw new Error(
          `${message} Samples and the JSON model editor still work offline.`,
        );
      }
      }
      const parsed = interpretationSchema.parse(payload);
      if (controller.signal.aborted) return;
      if (parsed.model) {
        const next = validateModel({
          ...parsed.model,
          assumptions: Array.from(
            new Set([...parsed.model.assumptions, ...parsed.ambiguities]),
          ),
        });
        commitModel(next, { preserveInterpretation: true });
        setEditing(false);
      }
      setInterpretation(parsed);
      setNotice(
        parsed.model
          ? "AI interpretation received. Review every rule and resolve ambiguities before trusting a finding."
          : "No executable model returned. See the interpretation notes or use the JSON editor.",
      );
    } catch (e) {
      if (!controller.signal.aborted)
        setError(`Interpretation unavailable: ${errorMessage(e)}`);
    } finally {
      if (interpretAbort.current === controller) setInterpreting(false);
    }
  }
  function patchReward() {
    const reward = model.actions.find(
      (a) => a.kind === "reward" && BigInt(a.currencyDelta) > 0n,
    );
    if (!reward) return;
    const rewardRule = model.rules.find(
      (r) =>
        reward.ruleIds.includes(r.id) &&
        r.text.includes(money(reward.currencyDelta)),
    );
    const clause = `Patch: ${reward.label} now pays 0 ${model.currency.label} in currency; all other requirements and effects remain unchanged.`;
    let ruleId = "reward_patch";
    while (model.rules.some((r) => r.id === ruleId)) ruleId += "_1";
    const replacement = rewardRule?.text.replace(
      money(reward.currencyDelta),
      money("0"),
    );
    try {
      commitModel({
        ...model,
        source:
          rewardRule && replacement
            ? model.source.replace(rewardRule.text, replacement)
            : `${model.source}\n\n${clause}`,
        rules:
          rewardRule && replacement
            ? model.rules.map((r) =>
                r.id === rewardRule.id ? { ...r, text: replacement } : r,
              )
            : [...model.rules, { id: ruleId, text: clause }],
        actions: model.actions.map((a) =>
          a.id === reward.id
            ? {
                ...a,
                currencyDelta: "0",
                ruleIds: rewardRule ? a.ruleIds : [...a.ruleIds, ruleId],
              }
            : a,
        ),
      });
      setNotice(
        "Reward payout set to zero in the action, source and rule text. Compare the previous trace or run a fresh search.",
      );
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  function compareOld(entry: VersionEntry) {
    const oldTrace = entry.evidence?.result.finding?.trace;
    if (!oldTrace) return;
    const ids = oldTrace.steps.map((s) => s.actionId);
    let firstIllegal: number | null = null,
      reason = "";
    for (let i = 0; i < ids.length; i++) {
      try {
        replay(model, ids.slice(0, i + 1));
      } catch (e) {
        firstIllegal = i + 1;
        reason = errorMessage(e);
        break;
      }
    }
    if (firstIllegal !== null)
      setComparison({
        ok: false,
        text: `First illegal action: step ${firstIllegal}`,
        details: `${ids[firstIllegal - 1]} · ${reason}. This blocks this trace only, not every possible exploit.`,
      });
    else {
      const next = replay(model, ids);
      const end = next.steps.at(-1)?.after ?? next.initial;
      const gain = BigInt(end.currency) - BigInt(next.initial.currency);
      const restored = model.resources.every(
        (r) => end.resources[r.id] === next.initial.resources[r.id],
      );
      const meets =
        gain >= BigInt(objective.minGain) &&
        (!objective.restoreResources || restored);
      setComparison({
        ok: meets,
        text: meets
          ? "Previous strategy still meets this objective"
          : "Actions remain legal; objective no longer met",
        details: `Replayed ${ids.length} actions against current initial state and rules. Net currency: ${money(gain.toString())}. Resources ${restored ? "restored" : "not restored"}. A fresh search is needed to test alternatives.`,
      });
    }
    setModal(null);
    setPlaying(false);
  }
  function fork() {
    resetRun();
    setShared(false);
    setReviewed(false);
    setEvidence(null);
    window.history.replaceState(null, "", location.pathname + location.search);
    setRecoveryBlocked(false);
    setNotice(
      "Forked into a private, editable local draft. The shared snapshot is unchanged.",
    );
  }
  const statusTitle = running
    ? "Following the possibilities."
    : finding
      ? finding.provisional
        ? "A possible loophole."
        : finding.certificate.kind === "repeatable-profit"
          ? "A profitable loop."
          : "A profitable sequence."
      : !result
        ? "Every rule has an edge."
        : result.status === "exhausted"
          ? "No loophole in these bounds."
          : result.status === "cancelled"
            ? "Search stopped."
            : result.status === "failed"
              ? "Search could not finish."
              : "Search limit reached.";

  return (
    <div className="app-shell">
      <header className="topbar">
        <a
          href={location.pathname}
          className="brand"
          aria-label="LOOPHOLE home"
          onClick={(e) => e.preventDefault()}
        >
          <span className="brand-symbol">↳</span>LOOPHOLE
          <span className="beta-tag">LAB</span>
        </a>
        <div className="brand-divider" />
        <span className="tagline">You wrote the rules. It found the infinite-money glitch.</span>
        <nav aria-label="Main navigation">
          <a className="github-link" href="https://github.com/byte271/LOOPHOLE" target="_blank" rel="noopener noreferrer"><Github size={16} /> GitHub</a>
          <button onClick={() => setSettingsOpen(true)} aria-label="Model API settings"><KeyRound size={16} /> API key</button>
          <button className="nav-active" onClick={() => setModal(null)}>
            Workspace
          </button>
          <button onClick={() => setModal("history")}>
            History <span className="count-badge">{history.length}</span>
          </button>
          <button
            className="icon-button"
            onClick={() => setModal("help")}
            aria-label="How LOOPHOLE works"
          >
            <CircleHelp size={19} />
          </button>
        </nav>
        <div className="offline-badge">
          <span className="live-dot" /> LOCAL ENGINE
        </div>
      </header>
      {settingsOpen && <Dialog title="Model API settings" onClose={closeSettings}><ModelSettings initial={modelSettings} onSave={(value) => { setModelSettings(value); setNotice(value.apiKey ? "Model settings saved on this device." : "API key removed from this device."); closeSettings(); }} /></Dialog>}
      <main>
        {shared && (
          <div className="shared-banner">
            <LockKeyhole size={17} />
            <div>
              <strong>Fixed challenge snapshot</strong>
              <span>
                Read-only model, objective and budgets. Unreviewed by design.
                Your private draft is untouched.
              </span>
            </div>
            <button className="button small" onClick={fork}>
              <GitBranch size={15} /> Fork to edit
            </button>
          </div>
        )}
        {error && (
          <div className="error-banner" role="alert">
            <TriangleAlert size={18} />
            <span>{error}</span>
            {recoveryBlocked && (
              <button
                className="text-button"
                onClick={() => {
                  try {
                    const raw = localStorage.getItem(STORAGE_KEY);
                    if (raw) {
                      const u = URL.createObjectURL(
                        new Blob([raw], { type: "application/json" }),
                      );
                      const a = document.createElement("a");
                      a.href = u;
                      a.download = "loophole-recovery.json";
                      a.click();
                      setTimeout(() => URL.revokeObjectURL(u), 1000);
                    }
                  } catch (e) {
                    setError(errorMessage(e));
                  }
                }}
              >
                Download recovery
              </button>
            )}
            <button
              className="icon-button"
              onClick={() => setError("")}
              aria-label="Dismiss error"
            >
              <X size={16} />
            </button>
          </div>
        )}
        <section className="workspace-heading">
          <div>
            <div className="eyebrow breadcrumb">
              SANDBOX <ChevronRight size={12} /> ECONOMY EXPLORER
            </div>
            <h1>
              Find the gap in the game<span>.</span>
            </h1>
            <p>Turn rules into a world. Find a loophole. Watch the proof.</p>
          </div>
          <div className="heading-actions">
            <span className="save-status">
              <span className="tiny-dot" />{" "}
              {shared
                ? "Fixed snapshot"
                : recoveryBlocked
                  ? "Recovery needs attention"
                  : saved}
            </span>
            <button
              className="button quiet"
              disabled={shared}
              onClick={() => persist(true)}
            >
              <Download size={15} /> Save draft
            </button>
            <button
              className="button"
              onClick={() => {
                setShareLink("");
                setShareConfirmed(false);
                setModal("share");
              }}
            >
              <Share2 size={15} /> Share challenge
            </button>
          </div>
        </section>
        <div className={`workspace ${expanded ? "map-expanded" : ""}`}>
          <aside className="source-panel panel">
            <header className="panel-heading">
              <div>
                <span className="section-number">01</span>
                <h2>The rulebook</h2>
              </div>
              <BookOpen size={17} />
            </header>
            <div className="source-body">
              <label className="field-label" htmlFor="sample">
                START WITH A SANDBOX
              </label>
              <div className="select-wrap">
                <select
                  id="sample"
                  disabled={shared}
                  value={
                    SAMPLES.find((s) => modelVersion(s.model) === version)
                      ?.id ?? "custom"
                  }
                  onChange={(e) => {
                    const sample = SAMPLES.find((s) => s.id === e.target.value);
                    if (sample) commitModel(sample.model);
                  }}
                >
                  <option value="custom" disabled>
                    Custom economy
                  </option>
                  {SAMPLES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={15} />
              </div>
              <p className="sample-subtitle">
                {SAMPLES.find((s) => modelVersion(s.model) === version)
                  ?.subtitle ?? model.description}
              </p>
              <div
                className="source-tabs"
                role="tablist"
                aria-label="Source format"
              >
                <button
                  role="tab"
                  aria-selected={tab === "rules"}
                  className={tab === "rules" ? "active" : ""}
                  onClick={() => setTab("rules")}
                >
                  <BookOpen size={14} />
                  Rules
                </button>
                <button
                  role="tab"
                  aria-selected={tab === "model"}
                  className={tab === "model" ? "active" : ""}
                  onClick={() => setTab("model")}
                >
                  <Braces size={15} />
                  Model <span>JSON</span>
                </button>
              </div>
              {tab === "rules" ? (
                <div role="tabpanel" aria-label="Rules">
                  <div className="subheading">
                    <span>{editing ? "SOURCE TEXT" : "ECONOMY RULES"}</span>
                    <button
                      className="text-button"
                      disabled={shared || interpreting}
                      onClick={() => setEditing(!editing)}
                    >
                      <Pencil size={12} />
                      {editing ? "View rules" : "Edit source"}
                    </button>
                  </div>
                  {editing ? (
                    <form onSubmit={interpret}>
                      <label htmlFor="source" className="sr-only">
                        Original economy rules
                      </label>
                      <textarea
                        id="source"
                        className="source-editor"
                        value={sourceDraft}
                        maxLength={30000}
                        readOnly={shared}
                        onChange={(e) => {
                          interpretAbort.current?.abort();
                          setInterpreting(false);
                          setSourceDraft(e.target.value);
                        }}
                      />
                      <div className="editor-foot">
                        <span>
                          {sourceDraft.length.toLocaleString()} / 30,000
                        </span>
                        <button
                          className="text-button"
                          type="button"
                          onClick={() => setSourceDraft(model.source)}
                        >
                          Discard edits
                        </button>
                      </div>
                      <button
                        className="button interpret-button"
                        type="submit"
                        disabled={interpreting || !aiConfigured || shared}
                      >
                        {interpreting ? (
                          <LoaderCircle className="spin" size={15} />
                        ) : (
                          <Sparkles size={15} />
                        )}
                        {interpreting ? "Interpreting…" : "Interpret with AI"}
                      </button>
                      <p className="microcopy">
                        {aiConfigured
                          ? "Sends these rules to your AI provider. Proposed rules require your review."
                          : "AI interpretation is unavailable. No generated output is simulated. Edit the declarative JSON model instead."}
                      </p>
                      <button
                        className="text-button"
                        type="button"
                        onClick={() => setTab("model")}
                      >
                        Open JSON editor <ArrowRight size={12} />
                      </button>
                    </form>
                  ) : (
                    <div className="rule-list">
                      {model.rules.map((rule, i) => (
                        <button
                          key={rule.id}
                          className={`rule-card ${activeRules.includes(rule.id) ? "highlighted" : ""}`}
                          onClick={() => {
                            const action = model.actions.find((a) =>
                              a.ruleIds.includes(rule.id),
                            );
                            setSelectedAction(action?.id ?? null);
                          }}
                        >
                          <span className="rule-number">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span>
                            <span className="rule-title">
                              {rule.id === "limits"
                                ? "Starting state & limits"
                                : (model.actions.find((a) =>
                                    a.ruleIds.includes(rule.id),
                                  )?.label ?? "Economy constraint")}
                            </span>
                            <span className="rule-text">{rule.text}</span>
                          </span>
                          {activeRules.includes(rule.id) && (
                            <span className="rule-active-dot" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div role="tabpanel" aria-label="JSON model">
                  <div className="subheading">
                    <span>DECLARATIVE MODEL · V1</span>
                    <span className="mono">{version.slice(0, 10)}</span>
                  </div>
                  <label htmlFor="json-model" className="sr-only">
                    Editable JSON model
                  </label>
                  <textarea
                    id="json-model"
                    spellCheck={false}
                    className="json-editor"
                    value={jsonDraft}
                    maxLength={120000}
                    readOnly={shared}
                    onChange={(e) => setJsonDraft(e.target.value)}
                  />
                  <div className="editor-foot">
                    <span>Validated, not executed as code</span>
                    <button
                      disabled={shared}
                      className="text-button"
                      onClick={() =>
                        setJsonDraft(JSON.stringify(model, null, 2))
                      }
                    >
                      Reset
                    </button>
                  </div>
                  <button
                    disabled={shared}
                    className="button full"
                    onClick={() => {
                      try {
                        commitModel(JSON.parse(jsonDraft));
                      } catch (e) {
                        setError(`Model not applied: ${errorMessage(e)}`);
                      }
                    }}
                  >
                    <Check size={15} /> Validate & apply model
                  </button>
                  <p className="microcopy">
                    Source clauses must match rule text literally. Currency uses
                    integer minor units. Applying edits resets review and
                    replay.
                  </p>
                </div>
              )}
              <div className={`review-box ${reviewed ? "is-reviewed" : ""}`}>
                <label>
                  <input
                    type="checkbox"
                    checked={reviewed}
                    disabled={shared || assumptions.length > 0 || dirty}
                    onChange={(e) => updateReview(e.target.checked)}
                  />
                  <span>
                    I reviewed this model
                    <span>The rules match the economy I intend.</span>
                  </span>
                </label>
                <ShieldCheck size={18} />
              </div>
              {assumptions.length > 0 && (
                <div className="ambiguity-box">
                  <strong>
                    <TriangleAlert size={14} /> {assumptions.length} unresolved{" "}
                    {assumptions.length === 1 ? "assumption" : "assumptions"}
                  </strong>
                  <ul>
                    {assumptions.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                  <p>
                    Resolve these explicitly in the JSON model. Review and
                    certification are unavailable until then.
                  </p>
                </div>
              )}
              {dirty && (
                <p className="inline-warning">
                  <Pencil size={13} /> Unapplied edits. Search and review are
                  paused until they are applied or discarded.
                </p>
              )}
              <div className="connection">
                <button
                  className="connection-toggle"
                  onClick={() => setApiSettings(!apiSettings)}
                >
                  <span
                    className={`tiny-dot ${aiConfigured ? "green" : ""}`}
                  />
                  {aiConfigured
                    ? "AI interpretation ready"
                    : "Offline-ready · no AI required"}
                  <Settings2 size={13} />
                </button>
                {apiSettings && (
                  <div className="connection-settings">
                    <p>
                      {api?.configured
                        ? `Server model: ${api.model}. ${api.requiresToken ? "Server access token required." : "No access token required."}`
                        : "Samples, JSON editing, search and replay work without an API key. Use API key in the top bar to connect your model."}
                    </p>
                    <label htmlFor="server-token">
                      <KeyRound size={12} /> Server access token (optional)
                    </label>
                    <input
                      id="server-token"
                      type="password"
                      autoComplete="off"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="Kept in memory only"
                    />
                    <span>Never stored, exported or shared.</span>
                  </div>
                )}
              </div>
            </div>
          </aside>
          <section className="center-column">
            <header className="center-heading">
              <div>
                <span className="section-number">02</span>
                <h2>{model.name}</h2>
              </div>
              <span className="version-pill">
                <span className="tiny-dot green" />
                {version.slice(0, 10)}
              </span>
            </header>
            <EconomyMap
              key={version}
              model={model}
              state={currentState}
              step={currentStep}
              previousStep={cursor > 1 ? trace?.steps[cursor - 2] : undefined}
              stepNumber={cursor}
              selectedAction={inspected?.id ?? null}
              onSelectAction={(id) => {
                setPlaying(false);
                setSelectedAction(id);
              }}
              expanded={expanded}
              onExpand={() => setExpanded(!expanded)}
            />
            <section className="state-panel panel">
              <div className="state-heading">
                <h3>
                  <Layers3 size={15} />{" "}
                  {cursor ? "Recorded inventory" : "Starting inventory"}
                </h3>
                <span className="mono">
                  TURN {currentState.turn}
                  {model.maxTurns !== null ? ` / ${model.maxTurns}` : " / ∞"}
                </span>
                <button
                  className="icon-button"
                  disabled={shared}
                  onClick={() => {
                    setInitialText(JSON.stringify(model.initial, null, 2));
                    setModal("initial");
                  }}
                  title="Edit initial state"
                  aria-label="Edit initial state"
                >
                  <Settings2 size={15} />
                </button>
              </div>
              <div className="inventory">
                <div className="inventory-item currency">
                  <span className="inventory-icon">
                    <Coins size={18} />
                  </span>
                  <div>
                    <span>{model.currency.label}</span>
                    <strong>{money(currentState.currency)}</strong>
                  </div>
                  {currentStep && (
                    <span
                      className={`delta ${BigInt(currentStep.after.currency) >= BigInt(currentStep.before.currency) ? "positive" : "negative"}`}
                    >
                      {BigInt(currentStep.after.currency) >=
                      BigInt(currentStep.before.currency)
                        ? "+"
                        : ""}
                      {money(
                        (
                          BigInt(currentStep.after.currency) -
                          BigInt(currentStep.before.currency)
                        ).toString(),
                      )}
                    </span>
                  )}
                </div>
                {model.resources.map((r) => (
                  <div className="inventory-item" key={r.id}>
                    <span className={`resource-icon ${r.kind}`}>
                      {r.kind === "flag" ? (
                        <CheckCheck size={16} />
                      ) : r.kind === "stock" ? (
                        <Layers3 size={16} />
                      ) : (
                        <span>◇</span>
                      )}
                    </span>
                    <div>
                      <span>{r.label}</span>
                      <strong>
                        {currentState.resources[r.id]}
                        <small> / {r.max.toLocaleString()}</small>
                      </strong>
                    </div>
                  </div>
                ))}
              </div>
              <div className="inventory-note">
                <Info size={12} /> Exact engine state. Playback never spends or
                invents resources.
              </div>
            </section>
            {comparison && (
              <div
                className={`comparison-card ${comparison.ok ? "warning" : ""}`}
              >
                <div>
                  <GitBranch size={18} />
                  <strong>{comparison.text}</strong>
                  <button
                    className="icon-button"
                    onClick={() => setComparison(null)}
                    aria-label="Dismiss comparison"
                  >
                    <X size={14} />
                  </button>
                </div>
                <p>{comparison.details}</p>
                <button
                  className="text-button"
                  onClick={startSearch}
                  disabled={running}
                >
                  Run fresh search <ArrowRight size={13} />
                </button>
              </div>
            )}
          </section>
          <aside className="analysis-column">
            <header className="panel-heading">
              <div>
                <span className="section-number">03</span>
                <h2>The analysis</h2>
              </div>
              <Terminal size={17} />
            </header>
            <section
              className={`verdict-card ${finding ? (finding.provisional ? "provisional" : "found") : ""} ${running ? "searching" : ""}`}
              aria-live="polite"
            >
              <div className="verdict-eyebrow">
                {running ? (
                  <LoaderCircle size={15} className="spin" />
                ) : finding ? (
                  <Zap size={15} />
                ) : (
                  <Search size={15} />
                )}
                {running
                  ? "EXPLORING REAL STATES"
                  : finding
                    ? finding.provisional
                      ? "PROVISIONAL FINDING"
                      : "ENGINE-VERIFIED TRACE"
                    : result
                      ? result.status.replace(/-/g, " ").toUpperCase()
                      : "LET’S TEST THE RULES"}
              </div>
              <h2>{statusTitle}</h2>
              <p>
                {running
                  ? "Checking legal actions, one exact state at a time. The worker can be stopped at any point."
                  : finding
                    ? finding.provisional
                      ? "This trace replays, but its model is not yet reviewed. Treat it as a hypothesis, not a certified exploit."
                      : finding.certificate.kind === "repeatable-profit"
                        ? "The sequence restores every resource and ends with more currency. Its repeatability is mathematically certified in this model."
                        : "The engine verified a gain. Repeatability is not certified; inspect the conditions below."
                    : result
                      ? result.message
                      : "Search this economy for a sequence that leaves you better off than you started."}
              </p>
              {finding && (
                <div className="finding-metrics">
                  <div>
                    <span>NET GAIN</span>
                    <strong>
                      +{money(finding.gain)}
                      <small>{model.currency.label}</small>
                    </strong>
                  </div>
                  <div>
                    <span>ACTIONS</span>
                    <strong>
                      {finding.trace.steps.length}
                      <small>
                        {result?.objective.mode === "shortest" &&
                        result.status === "found"
                          ? "shortest found"
                          : "recorded"}
                      </small>
                    </strong>
                  </div>
                </div>
              )}
              {!reviewed && !finding && !running && (
                <span className="review-status">
                  <Info size={12} /> Unreviewed model · findings are provisional
                </span>
              )}
              {result && !running && (
                <p className="scope-note">
                  {result.depthBoundComplete
                    ? `Depth-bounded graph exhausted through ${result.budget.maxDepth} actions.`
                    : "Search did not exhaust the full depth-bounded graph."}{" "}
                  {finding && result.objective.mode === "highest-gain"
                    ? result.depthBoundComplete
                      ? "Highest gain is proven only within these bounds. "
                      : `Best found, not proven optimal (${result.status}). `
                    : ""}
                  No claim about a real implementation.
                </p>
              )}
            </section>
            <section className="objective-panel">
              <div className="subheading">
                <h3>
                  <Settings2 size={14} /> Search objective
                </h3>
                <span className="mono">BOUNDED</span>
              </div>
              <div className="segmented" aria-label="Search mode">
                <button
                  disabled={shared}
                  className={objective.mode === "shortest" ? "active" : ""}
                  onClick={() =>
                    updateObjective({ ...objective, mode: "shortest" })
                  }
                >
                  Shortest path
                </button>
                <button
                  disabled={shared}
                  className={objective.mode === "highest-gain" ? "active" : ""}
                  onClick={() =>
                    updateObjective({ ...objective, mode: "highest-gain" })
                  }
                >
                  Highest gain
                </button>
              </div>
              <div className="gain-field">
                <label htmlFor="min-gain">
                  Minimum gain <span>minor units</span>
                </label>
                <div>
                  <Plus size={12} />
                  <input
                    id="min-gain"
                    inputMode="numeric"
                    disabled={shared}
                    value={objective.minGain}
                    onChange={(e) =>
                      updateObjective({ ...objective, minGain: e.target.value })
                    }
                    aria-describedby="gain-unit"
                  />
                </div>
              </div>
              <span id="gain-unit" className="sr-only">
                Integer currency minor units, with {model.currency.decimals}{" "}
                decimal places
              </span>
              <label className="restore-check">
                <input
                  type="checkbox"
                  checked={objective.restoreResources}
                  disabled={shared}
                  onChange={(e) =>
                    updateObjective({
                      ...objective,
                      restoreResources: e.target.checked,
                    })
                  }
                />
                Return all resources to their start
              </label>
              <details className="budget-details">
                <summary>
                  Search limits
                  <span>
                    {budget.maxDepth} steps ·{" "}
                    {budget.maxStates.toLocaleString()} states
                    <ChevronDown size={12} />
                  </span>
                </summary>
                <div className="budget-grid">
                  <label>
                    Action depth
                    <input
                      type="number"
                      min="1"
                      max="40"
                      value={budget.maxDepth}
                      disabled={shared}
                      onChange={(e) =>
                        updateBudget({
                          ...budget,
                          maxDepth: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    State budget
                    <input
                      type="number"
                      min="1"
                      max="100000"
                      value={budget.maxStates}
                      disabled={shared}
                      onChange={(e) =>
                        updateBudget({
                          ...budget,
                          maxStates: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    Time (ms)
                    <input
                      type="number"
                      min="1"
                      max="15000"
                      value={budget.maxMilliseconds}
                      disabled={shared}
                      onChange={(e) =>
                        updateBudget({
                          ...budget,
                          maxMilliseconds: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                </div>
                <p className="microcopy">
                  Operational caps, not game rules. Highest gain is optimal only
                  when the depth-bounded graph is fully exhausted.
                </p>
              </details>
              <button
                className={`button search-button ${running ? "cancel" : ""}`}
                disabled={!running && dirty}
                onClick={running ? cancelSearch : startSearch}
              >
                {running ? <Square size={16} /> : <Search size={17} />}
                {running
                  ? "Cancel search"
                  : result?.status === "failed" ||
                      result?.status === "cancelled"
                    ? "Retry search"
                    : "Find a loophole"}
                {!running && <ArrowRight size={17} />}
              </button>
              <div className="engine-caption">
                <span className="tiny-dot green" />
                Deterministic engine <span>v{ENGINE_VERSION}</span>
              </div>
            </section>
            <div
              className="search-stats"
              aria-live={running ? "polite" : "off"}
            >
              <div>
                <span>EXPLORED</span>
                <strong>
                  {(
                    result?.progress.explored ?? progress.explored
                  ).toLocaleString()}
                </strong>
              </div>
              <div>
                <span>FRONTIER</span>
                <strong>
                  {(
                    result?.progress.frontier ?? progress.frontier
                  ).toLocaleString()}
                </strong>
              </div>
              <div>
                <span>ELAPSED</span>
                <strong>
                  {Math.round(result?.progress.elapsedMs ?? progress.elapsedMs)}
                  <small>ms</small>
                </strong>
              </div>
            </div>
            <section className="inspector">
              <div className="progress-detail">
                <span>
                  Discovered{" "}
                  {(
                    result?.progress.discovered ?? progress.discovered
                  ).toLocaleString()}
                </span>
                <span>Depth {result?.progress.depth ?? progress.depth}</span>
              </div>
              <div className="subheading">
                <h3>
                  {inspected ? "Action inspector" : "Proof, not a prediction"}
                </h3>
                {inspected ? (
                  <span className="mono">{inspected.kind.toUpperCase()}</span>
                ) : (
                  <FileCheck2 size={15} />
                )}
              </div>
              {inspected ? (
                <>
                  <h4>{inspected.label}</h4>
                  <p className="inspector-id">{inspected.id} · costs 1 turn</p>
                  <div className="inspector-delta">
                    <span>Currency effect</span>
                    <strong>
                      {BigInt(inspected.currencyDelta) >= 0n ? "+" : ""}
                      {money(inspected.currencyDelta)}
                    </strong>
                  </div>
                  {Object.entries(inspected.deltas).map(([key, delta]) => (
                    <div className="inspector-delta" key={key}>
                      <span>
                        {model.resources.find((r) => r.id === key)?.label ??
                          key}
                      </span>
                      <strong>
                        {delta >= 0 ? "+" : ""}
                        {delta}
                      </strong>
                    </div>
                  ))}
                  <p className="microcopy">
                    <strong>Guards:</strong>{" "}
                    {inspected.requires.length
                      ? inspected.requires
                          .map(
                            (g) =>
                              `${g.field} ${{ gte: "≥", lte: "≤", eq: "=" }[g.op]} ${g.value}`,
                          )
                          .join(" · ")
                      : "No explicit guards"}
                    . Resource bounds and nonnegative currency always apply.
                  </p>
                  <p className="source-ref">
                    <BookOpen size={12} /> {inspected.ruleIds.join(", ")}{" "}
                    highlighted in the rulebook
                  </p>
                </>
              ) : (
                <>
                  <p>
                    Every finding comes with an exact, replayable sequence and
                    its supporting rules.
                  </p>
                  <div className="proof-check">
                    <Check size={14} />
                    Independent trace verification
                  </div>
                  <div className="proof-check">
                    <Check size={14} />
                    No imaginary actions or balances
                  </div>
                  <p className="microcopy">
                    Select any action on the map to inspect its guards and
                    effects.
                  </p>
                </>
              )}
            </section>
          </aside>
        </div>
        <section className="replay-panel panel">
          <header className="replay-header">
            <div>
              <span className="replay-icon">
                <Play size={14} fill="currentColor" />
              </span>
              <h2>Follow the loophole</h2>
              <span className="replay-subtitle">
                {trace
                  ? `${trace.steps.length} recorded actions. Every move accounted for.`
                  : "A replayable proof, not just an answer."}
              </span>
            </div>
            <button
              className="text-button"
              disabled={!evidence}
              onClick={() => {
                if (evidence)
                  try {
                    downloadEvidence(evidence);
                  } catch (e) {
                    setError(errorMessage(e));
                  }
              }}
            >
              <Download size={14} />
              Export evidence <ArrowUpRight size={12} />
            </button>
          </header>
          <div className="replay-body">
            <div className="playback-controls">
              <button
                className="play-button"
                disabled={!trace?.steps.length}
                onClick={() => {
                  if (cursor >= (trace?.steps.length ?? 0)) setCursor(0);
                  setSelectedAction(null);
                  setPlaying(!playing);
                }}
                aria-label={playing ? "Pause replay" : "Play recorded trace"}
              >
                {playing ? (
                  <Pause size={19} fill="currentColor" />
                ) : (
                  <Play size={19} fill="currentColor" />
                )}
              </button>
              <div>
                <button
                  className="icon-button"
                  disabled={!trace}
                  onClick={() => {
                    setPlaying(false);
                    setCursor(0);
                    setSelectedAction(null);
                  }}
                  aria-label="Restart recorded trace"
                  title="Restart"
                >
                  <RotateCcw size={16} />
                </button>
                <button
                  className="icon-button"
                  disabled={!trace || cursor >= trace.steps.length}
                  onClick={() => {
                    setPlaying(false);
                    setCursor((c) => c + 1);
                    setSelectedAction(null);
                  }}
                  aria-label="Step forward"
                  title="Next recorded step"
                >
                  <SkipForward size={16} />
                </button>
              </div>
              <span className="mono">
                {String(cursor).padStart(2, "0")} /{" "}
                {String(trace?.steps.length ?? 0).padStart(2, "0")}
              </span>
            </div>
            <div className="timeline" aria-label="Recorded action timeline">
              {trace ? (
                <>
                  <button
                    className={`timeline-start ${cursor === 0 ? "active" : ""}`}
                    onClick={() => {
                      setCursor(0);
                      setPlaying(false);
                      setSelectedAction(null);
                    }}
                  >
                    <span className="timeline-dot">
                      <CircleHelp size={14} />
                    </span>
                    <strong>Start</strong>
                    <span>
                      {money(trace.initial.currency)} {model.currency.label}
                    </span>
                  </button>
                  {trace.steps.map((step, i) => {
                    const a = model.actions.find(
                      (a) => a.id === step.actionId,
                    )!;
                    const delta =
                      BigInt(step.after.currency) -
                      BigInt(step.before.currency);
                    return (
                      <div className="timeline-link" key={i}>
                        <ArrowRight size={14} className="timeline-arrow" />
                        <button
                          className={`timeline-step ${a.kind} ${cursor === i + 1 ? "active" : ""} ${cursor > i + 1 ? "past" : ""}`}
                          onClick={() => {
                            setCursor(i + 1);
                            setPlaying(false);
                            setSelectedAction(null);
                          }}
                          aria-current={cursor === i + 1 ? "step" : undefined}
                        >
                          <div>
                            <span className="step-index">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <strong>{a.label}</strong>
                            {cursor > i + 1 && <Check size={12} />}
                          </div>
                          <span>
                            {money(step.before.currency)}{" "}
                            <ArrowRight size={11} />{" "}
                            {money(step.after.currency)}
                            <b
                              className={delta >= 0n ? "positive" : "negative"}
                            >
                              {delta >= 0n ? "+" : ""}
                              {money(delta.toString())}
                            </b>
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </>
              ) : (
                <div className="timeline-empty">
                  <span className="empty-path">
                    <span />
                    <i />
                    <span />
                    <i />
                    <span />
                    <i />
                    <span />
                  </span>
                  <div>
                    <strong>Your evidence trail starts here</strong>
                    <p>
                      Run a search to discover a real sequence. Only verified
                      steps will appear.
                    </p>
                  </div>
                  <ArrowDown size={22} className="empty-arrow" />
                </div>
              )}
            </div>
          </div>
          {currentStep && (
            <div className="step-detail">
              <span className="step-detail-title">
                <FileCheck2 size={14} /> Step {cursor} verified
              </span>
              <span>
                Currency: {money(currentStep.before.currency)} →{" "}
                {money(currentStep.after.currency)}
              </span>
              {model.resources.map((r) => (
                <span key={r.id}>
                  {r.label}: {currentStep.before.resources[r.id]} →{" "}
                  {currentStep.after.resources[r.id]}
                </span>
              ))}
              <span>
                Turn: {currentStep.before.turn} → {currentStep.after.turn}
              </span>
              <details>
                <summary>{currentStep.checks.length} recorded checks</summary>
                <ul>
                  {currentStep.checks.map((c, i) => (
                    <li key={i}>
                      <Check size={12} />
                      {c.label}: {c.actual} (expected {c.expected}) ·{" "}
                      {c.passed ? "passed" : "failed"}
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          )}
        </section>
        {finding && (
          <section className="evidence-notes">
            <div>
              <ShieldCheck size={19} />
              <div>
                <h3>
                  {finding.certificate.kind === "repeatable-profit"
                    ? "Why this loop can repeat"
                    : "What this evidence does and does not prove"}
                </h3>
                {(finding.certificate.kind === "repeatable-profit"
                  ? finding.certificate.argument
                  : finding.certificate.reasons
                ).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
                <p>
                  Gain is computed from the recorded end balance minus the
                  pinned initial balance. This is evidence about this model, not
                  an audit of a real game.
                </p>
              </div>
            </div>
            {!shared &&
              model.actions.some(
                (a) => a.kind === "reward" && BigInt(a.currencyDelta) > 0n,
              ) && (
                <button className="button" onClick={patchReward}>
                  <Pencil size={14} />
                  Try a patch: zero reward
                </button>
              )}
          </section>
        )}
        {evidence?.result.finding && <TraceNarrative evidence={evidence} configured={aiConfigured} modelSettings={modelSettings} token={token} requiresToken={!!api?.requiresToken} />}
        {interpretation && (
          <section className="interpretation-notes panel">
            <header>
              <Sparkles size={17} />
              <h3>AI interpretation notes</h3>
              <span>Proposals, not engine evidence</span>
            </header>
            <p>{interpretation.explanation}</p>
            {interpretation.ambiguities.length > 0 && (
              <div className="ambiguity-box">
                <strong>Ambiguities raised by the interpreter</strong>
                <ul>
                  {interpretation.ambiguities.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="strategy-grid">
              {interpretation.strategies.map((s, i) => (
                <article key={i}>
                  <strong>{s.title}</strong>
                  <p>{s.rationale}</p>
                  <code>{s.actionIds.join(" → ")}</code>
                  <span>
                    {result?.candidateResults?.find(
                      (c) => canonical(c.actionIds) === canonical(s.actionIds),
                    )
                      ? (() => {
                          const checked = result.candidateResults!.find(
                            (c) =>
                              canonical(c.actionIds) === canonical(s.actionIds),
                          )!;
                          return `${checked.accepted ? "Engine accepted" : "Engine rejected"}: ${checked.reason}`;
                        })()
                      : "Candidate only · independently checked on next search"}
                  </span>
                </article>
              ))}
            </div>
            {interpretation.suggestedChanges.length > 0 && (
              <details>
                <summary>Suggested changes</summary>
                <ul>
                  {interpretation.suggestedChanges.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </details>
            )}
            {interpretation.usage && (
              <p className="microcopy">
                {interpretation.usage.model} ·{" "}
                {interpretation.usage.inputTokens} input /{" "}
                {interpretation.usage.outputTokens} output tokens · estimated $
                {interpretation.usage.estimatedCostUsd}
              </p>
            )}
          </section>
        )}
        <footer className="workspace-footer">
          <span>
            <LockKeyhole size={12} /> Private by default. Your draft stays in
            this browser.
          </span>
          <span>
            The model proposes. <strong>The engine verifies.</strong>
            <span className="footer-star">✳</span>
          </span>
        </footer>
      </main>
      {modal && error && (
        <div className="toast error-toast" role="alert">
          <TriangleAlert size={16} />
          <span>{error}</span>
          <button
            className="icon-button"
            onClick={() => setError("")}
            aria-label="Dismiss validation error"
          >
            <X size={14} />
          </button>
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          <Check size={16} />
          <span>{notice}</span>
          <button
            className="icon-button"
            onClick={() => setNotice("")}
            aria-label="Dismiss notification"
          >
            <X size={14} />
          </button>
        </div>
      )}
      {modal === "share" && (
        <Dialog title="Share a fixed challenge" onClose={closeModal}>
          <div className="dialog-icon">
            <Share2 size={23} />
          </div>
          <p className="modal-intro">
            A snapshot, not a window into your workspace.
          </p>
          <p>
            The link will contain the full current model and its source, initial
            state, objective, search budgets and engine version. Anyone with the
            link can read them. The recipient starts with{" "}
            <strong>reviewed: false</strong>.
          </p>
          <div className="share-summary">
            <span>{model.name}</span>
            <code>{version.slice(0, 18)}</code>
            <span>
              {objective.mode} · +{objective.minGain} minor units ·{" "}
              {budget.maxDepth} actions
            </span>
          </div>
          <p className="microcopy">
            No private draft history, results, tokens, server logs or AI prompts
            are included. The URL fragment is not published to a server.
            Browsers may impose their own URL length limits.
          </p>
          <label className="confirm-share">
            <input
              type="checkbox"
              checked={shareConfirmed}
              onChange={(e) => setShareConfirmed(e.target.checked)}
            />
            I understand the complete model and source will be readable by
            anyone with this link.
          </label>
          <button
            className="button search-button"
            disabled={!shareConfirmed || dirty}
            onClick={() => {
              try {
                ObjectiveSchema.parse(objective);
                BudgetSchema.parse(budget);
                setShareLink(challengeURL(model, objective, budget));
              } catch (e) {
                setError(errorMessage(e));
              }
            }}
          >
            <Share2 size={16} />
            Create snapshot link
          </button>
          {dirty && (
            <p className="inline-warning">
              Apply or discard edits before creating a snapshot.
            </p>
          )}
          {shareLink && (
            <div className="share-link">
              <label htmlFor="snapshot-link">Fixed challenge URL</label>
              <textarea
                id="snapshot-link"
                readOnly
                value={shareLink}
                onFocus={(e) => e.target.select()}
              />
              <button
                className="button full"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(shareLink);
                    setNotice(
                      "Challenge link copied. This does not publish or send it anywhere.",
                    );
                  } catch {
                    setNotice(
                      "Clipboard unavailable. Select and copy the URL above.",
                    );
                  }
                }}
              >
                <Copy size={14} /> Copy link
              </button>
            </div>
          )}
        </Dialog>
      )}
      {modal === "initial" && (
        <Dialog title="Set the starting state" onClose={closeModal}>
          <p>
            Edit exact integer currency minor units, every named resource, and
            the starting turn. This creates a new model version and clears
            current playback.
          </p>
          <label className="field-label" htmlFor="initial-state">
            INITIAL STATE JSON
          </label>
          <textarea
            id="initial-state"
            className="json-editor initial-editor"
            value={initialText}
            onChange={(e) => setInitialText(e.target.value)}
            spellCheck={false}
          />
          <button
            className="button search-button"
            onClick={() => {
              try {
                commitModel({ ...model, initial: JSON.parse(initialText) });
                setModal(null);
              } catch (e) {
                setError(`Initial state not applied: ${errorMessage(e)}`);
              }
            }}
          >
            <Check size={16} />
            Validate & apply starting state
          </button>
        </Dialog>
      )}
      {modal === "history" && (
        <Dialog title="Model version history" onClose={closeModal} wide>
          <p>
            Up to five previous versions stay on this browser. Each result
            remains pinned to the model that produced it. Comparing a trace
            independently replays its action IDs against the current model and
            initial state.
          </p>
          <div className="history-current">
            <span className="tiny-dot green" />
            <strong>Current · {model.name}</strong>
            <code>{version.slice(0, 16)}</code>
          </div>
          {history.length === 0 ? (
            <div className="history-empty">
              <History size={32} />
              <h3>No previous versions yet.</h3>
              <p>
                Edit a model or try a sample to create a version. Search before
                patching to compare its evidence afterward.
              </p>
            </div>
          ) : (
            history.map((entry, i) => (
              <article
                className="history-entry"
                key={`${entry.createdAt}-${i}`}
              >
                <div>
                  <span className="version-index">
                    {String(history.length - i).padStart(2, "0")}
                  </span>
                  <div>
                    <h3>{entry.model.name}</h3>
                    <code>{modelVersion(entry.model).slice(0, 16)}</code>
                    <p>
                      {new Date(entry.createdAt).toLocaleString()} ·{" "}
                      {entry.reviewed ? "Reviewed" : "Unreviewed"} ·{" "}
                      {entry.evidence?.result.status ?? "Not searched"}
                    </p>
                  </div>
                </div>
                <div className="history-actions">
                  <button
                    className="button small"
                    disabled={!entry.evidence?.result.finding}
                    onClick={() => {
                      try {
                        compareOld(entry);
                      } catch (e) {
                        setError(errorMessage(e));
                      }
                    }}
                  >
                    <GitBranch size={13} />
                    Compare trace
                  </button>
                  <button
                    className="button small"
                    disabled={!entry.evidence}
                    onClick={() => {
                      if (entry.evidence)
                        try {
                          downloadEvidence(entry.evidence);
                        } catch (e) {
                          setError(errorMessage(e));
                        }
                    }}
                  >
                    <Download size={13} />
                    Evidence
                  </button>
                  <button
                    className="text-button"
                    disabled={shared}
                    onClick={() => {
                      commitModel(entry.model);
                      setModal(null);
                    }}
                  >
                    Restore as draft
                  </button>
                </div>
              </article>
            ))
          )}
          {history.length > 0 && (
            <button
              className="text-button danger"
              disabled={shared}
              onClick={() => {
                setHistory([]);
                setNotice(
                  "Older local versions cleared. Downloaded evidence and shared links are unchanged.",
                );
              }}
            >
              Clear older local history
            </button>
          )}
          <button
            className="button search-button"
            onClick={() => {
              setModal(null);
              startSearch();
            }}
            disabled={running || dirty}
          >
            <Search size={16} />
            Fresh search on current model
          </button>
        </Dialog>
      )}
      {modal === "help" && (
        <Dialog
          title="A little adversarial curiosity."
          onClose={closeModal}
          wide
        >
          <div className="help-grid">
            <article>
              <span>01</span>
              <h3>Make the rules explicit</h3>
              <p>
                Start with a sample or edit its declarative JSON. Optional AI
                interpretation proposes a model from prose. Review the source,
                guards, finite stock, reward flags, currency effects and initial
                resources. Nothing executes arbitrary code.
              </p>
            </article>
            <article>
              <span>02</span>
              <h3>Search the actual model</h3>
              <p>
                The local worker explores exact reachable states within your
                depth, state and time budgets. Unreviewed models yield
                provisional findings. “No finding” is always bounded, never a
                guarantee of safety.
              </p>
            </article>
            <article>
              <span>03</span>
              <h3>Replay. Patch. Repeat.</h3>
              <p>
                Playback uses only independently verified recorded actions. A
                repeatable-profit certificate requires restored resources,
                uncapped turns and compatible guards. Patch the model, compare
                the old trace, then search again.
              </p>
            </article>
          </div>
          <div className="help-note">
            <LockKeyhole size={18} />
            <p>
              Local drafts autosave after edits and never auto-share. Sharing
              requires explicit confirmation and puts an immutable snapshot in
              the URL fragment. AI source requests only occur when you click
              Interpret.
            </p>
          </div>
          <button className="button full" onClick={closeModal}>
            Back to the workspace <ArrowRight size={15} />
          </button>
        </Dialog>
      )}
    </div>
  );
}
