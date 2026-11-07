// Case specs (PLAN §13): what a user enters in the /new wizard. The local worker (glassbox/worker.py) turns a
// spec into a target, dry-runs it, and runs it. Shape mirrors glassbox/cases.py.

import { timingSafeEqual } from "node:crypto";

export type VerifyMode = "json_flag" | "test_command" | "same_output" | "none";
export type ParseMode = "json_key" | "regex" | "last_number";

export type CaseSpec = {
  id: string;
  name: string;
  goal: string;
  workspace: { path: string };
  editable: string[];
  measure: { command: string; parse: { mode: ParseMode; key?: string; pattern?: string }; timeout_s?: number };
  metric: { label: string; unit?: string; direction: "lower" | "higher" };
  verify: { mode: VerifyMode; key?: string; command?: string };
  budget: { max_experiments: number; backend: "anthropic" | "meta"; model?: string; budget_usd?: number };
};

export type CaseStatus =
  | "intake_requested" // plain-language description waiting for the worker's intake agent
  | "interpreting"
  | "needs_input" // the intake agent asked clarifying questions
  | "draft"
  | "dry_run_requested"
  | "dry_running"
  | "ready"
  | "dry_run_failed"
  | "invalid"
  | "queued"
  | "starting"
  | "running"
  | "finished"
  | "failed";

export type Message = { role: "user" | "glassbox"; text: string; at: number };
export type Question = { field: string; question: string; suggestion?: string };

export type CaseDoc = {
  _id: string;
  spec: CaseSpec;
  conversation?: Message[];
  summary?: string;
  questions?: Question[];
  status: CaseStatus;
  dry_run?: { ok: boolean; value: number | null; correct: boolean; error: { kind: string; message: string } | null; errors?: string[] };
  run_id?: string;
  runs?: string[];
  worker?: string;
  updated_at: number;
  message?: string;
};

export const ID_RE = /^[a-z0-9][a-z0-9-]{1,47}$/;

/** Shape checks the server can do (paths are checked by the worker, which has the files). */
export function validateSpec(s: Partial<CaseSpec>): string[] {
  const e: string[] = [];
  if (!ID_RE.test(s.id ?? "")) e.push("id: 2-48 chars of a-z, 0-9 and dashes");
  if (!s.name?.trim()) e.push("name is required");
  if (!s.goal?.trim()) e.push("goal is required");
  if (!s.workspace?.path?.startsWith("/")) e.push("workspace.path must be an absolute path on the worker machine");
  if (!s.editable?.length) e.push("list at least one editable file or glob");
  if (!s.measure?.command?.trim()) e.push("measure command is required");
  if (s.measure?.parse?.mode === "json_key" && !s.measure.parse.key) e.push("JSON key for the metric is required");
  if (s.measure?.parse?.mode === "regex" && !s.measure.parse.pattern) e.push("regex pattern is required");
  if (!s.metric?.label?.trim()) e.push("metric label is required");
  if (s.metric?.direction !== "lower" && s.metric?.direction !== "higher") e.push("metric direction must be lower or higher");
  if (!s.verify?.mode) e.push("choose how correctness is verified");
  if ((s.verify?.mode === "test_command" || s.verify?.mode === "same_output") && !s.verify.command?.trim())
    e.push("verification command is required for this mode");
  if (!s.budget?.max_experiments || s.budget.max_experiments < 1 || s.budget.max_experiments > 100) e.push("max experiments: 1-100");
  return e;
}

export function authorized(req: Request): boolean {
  const token = process.env.GLASSBOX_INGEST_TOKEN;
  if (!token) return false;
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(got);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
