// Ingest: validate events posted by any agent harness (PLAN §3: the event log is the single source of truth).
// Server assigns seq (and H#/E# ids when missing); everything else is the event schema from PLAN §4.5.

export const EVENT_TYPES = [
  "run_started",
  "hypothesis_proposed",
  "hypothesis_linked",
  "experiment_run",
  "experiment_failed",
  "experiment_interpreted",
  "hypothesis_closed",
  "gate_blocked",
  "agent_action",
  "agent_message",
  "run_finished",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export type IncomingEvent = { type: string; [k: string]: unknown };

const DIRECTIONS = ["decrease", "increase", "no_change"];
const RELATIONS = ["contradicts", "depends_on", "refines"];
const CLOSE = ["confirmed", "refuted", "abandoned"];
export const MAX_EVENTS_PER_REQUEST = 500;
export const MAX_EVENT_BYTES = 64 * 1024;

const isStr = (v: unknown) => typeof v === "string" && v.trim().length > 0;
const isNum = (v: unknown) => typeof v === "number" && Number.isFinite(v);

/** Returns an error message, or null if the event is acceptable. */
export function validate(ev: IncomingEvent): string | null {
  if (!ev || typeof ev !== "object") return "event must be an object";
  if (!EVENT_TYPES.includes(ev.type as EventType)) return `unknown type '${ev.type}' (allowed: ${EVENT_TYPES.join(", ")})`;
  if (JSON.stringify(ev).length > MAX_EVENT_BYTES) return `event larger than ${MAX_EVENT_BYTES} bytes`;
  switch (ev.type as EventType) {
    case "run_started": {
      const task = ev.task as Record<string, unknown> | undefined;
      if (!task || !isStr(task.name)) return "run_started needs task.name";
      const m = task.metric as Record<string, unknown> | undefined;
      if (m && m.direction !== undefined && !["lower", "higher"].includes(m.direction as string)) return "task.metric.direction must be 'lower' or 'higher'";
      return null;
    }
    case "hypothesis_proposed": {
      for (const k of ["claim", "topic"]) if (!isStr(ev[k])) return `hypothesis_proposed needs '${k}'`;
      const p = ev.prediction as Record<string, unknown> | undefined;
      if (!p || !DIRECTIONS.includes(p.direction as string)) return `prediction.direction must be one of ${DIRECTIONS.join(", ")}`;
      if (!isNum(p.confidence) || (p.confidence as number) < 0 || (p.confidence as number) > 1) return "prediction.confidence must be a number in [0, 1]";
      return null;
    }
    case "hypothesis_linked":
      if (!isStr(ev.from) || !isStr(ev.to)) return "hypothesis_linked needs 'from' and 'to'";
      if (!RELATIONS.includes(ev.relation as string)) return `relation must be one of ${RELATIONS.join(", ")}`;
      return null;
    case "experiment_run":
      if (!isNum(ev.metric_after)) return "experiment_run needs numeric 'metric_after'";
      return null;
    case "experiment_failed":
      return isStr(ev.error_kind) ? null : "experiment_failed needs 'error_kind'";
    case "experiment_interpreted":
      return typeof ev.kept === "boolean" ? null : "experiment_interpreted needs boolean 'kept'";
    case "hypothesis_closed":
      if (!isStr(ev.id)) return "hypothesis_closed needs 'id'";
      return CLOSE.includes(ev.status as string) ? null : `status must be one of ${CLOSE.join(", ")}`;
    default:
      return null;
  }
}

/** Fields the server owns; clients can't set them. */
export function strip(ev: IncomingEvent): IncomingEvent {
  const { run_id: _r, seq: _s, _id: _i, ...rest } = ev as IncomingEvent & { run_id?: unknown; seq?: unknown; _id?: unknown };
  return rest;
}

export const RUN_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
