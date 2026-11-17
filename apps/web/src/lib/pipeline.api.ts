import { api } from "./api";
import type { MetaPlatform } from "./workspace.api";

export type PipelineTrigger = "NEW_COMMENT" | "NEW_MESSAGE" | "NEW_LEAD" | "HOT_LEAD";
export type LeadStatusValue = "NEW" | "CONTACTED" | "QUALIFIED" | "WON" | "LOST";

// Aligné sur apps/api/src/modules/pipelines/pipeline.schema.ts : le serveur rejette toute autre forme
export type PipelineStep =
  | { id: string; type: "MATCH_RULE"; config: { ruleId: string } }
  | { id: string; type: "MIN_SCORE"; config: { min: number } }
  | { id: string; type: "SEND_DM"; config: { text: string } }
  | { id: string; type: "SET_LEAD_STATUS"; config: { status: LeadStatusValue } }
  | { id: string; type: "ESCALATE"; config: Record<string, never> }
  | { id: string; type: "NOTIFY"; config: { text: string } };

export type StepType = PipelineStep["type"];

export interface Pipeline {
  id: string;
  name: string;
  description: string | null;
  trigger: PipelineTrigger;
  isActive: boolean;
  steps: PipelineStep[];
  accountId: string | null;
  account: { id: string; name: string; platform: MetaPlatform | "TIKTOK"; avatarUrl: string | null } | null;
  runCount: number;
  lastRunAt: string | null;
  createdAt: string;
}

export interface PipelineInput {
  name: string;
  description: string | null;
  trigger: PipelineTrigger;
  accountId: string | null;
  steps: PipelineStep[];
  isActive?: boolean;
}

export interface TraceEntry {
  stepId: string;
  type: StepType;
  label: string;
  status: "ok" | "skipped" | "failed";
  detail?: string;
}

export interface PipelineRun {
  id: string;
  pipelineId: string;
  pipeline: { id: string; name: string };
  status: "SUCCESS" | "FAILED" | "STOPPED";
  subject: string;
  trace: TraceEntry[];
  error: string | null;
  createdAt: string;
}

type Res<T> = { status: string; data: T };

export const pipelineApi = {
  list: () => api.get<Res<Pipeline[]>>("/pipelines").then((r) => r.data),
  create: (body: PipelineInput) => api.post<Res<Pipeline>>("/pipelines", body).then((r) => r.data),
  update: (id: string, body: Partial<PipelineInput>) => api.patch<Res<Pipeline>>(`/pipelines/${id}`, body).then((r) => r.data),
  remove: (id: string) => api.delete<void>(`/pipelines/${id}`),
  runs: (pipelineId?: string) => api.get<Res<PipelineRun[]>>(`/pipelines/runs${pipelineId ? `?pipelineId=${pipelineId}` : ""}`).then((r) => r.data),
};
