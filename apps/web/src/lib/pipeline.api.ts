import { api } from "./api";

export type PipelineTrigger = "NEW_COMMENT" | "NEW_MESSAGE" | "NEW_LEAD" | "HOT_LEAD";
export type LeadStatusValue = "NEW" | "CONTACTED" | "QUALIFIED" | "WON" | "LOST";
export type LeadIntentValue = "prix" | "commande" | "livraison" | "disponibilite" | "question" | "reclamation" | "compliment" | "autre";

// Aligné sur apps/api/src/modules/pipelines/pipeline.schema.ts : le serveur rejette toute autre forme
export type PipelineStep =
  | { id: string; type: "MATCH_RULE"; config: { ruleId: string } }
  | { id: string; type: "MIN_SCORE"; config: { min: number } }
  | { id: string; type: "KEYWORD"; config: { keywords: string; mode: "CONTAINS" | "EXACT" } }
  | { id: string; type: "CHANNEL"; config: { kind: "COMMENT" | "DIRECT" } }
  | { id: string; type: "PLATFORM"; config: { platform: "FACEBOOK" | "INSTAGRAM" } }
  | { id: string; type: "LEAD_STATUS"; config: { statuses: LeadStatusValue[] } }
  | { id: string; type: "LEAD_INTENT"; config: { intents: LeadIntentValue[] } }
  | { id: string; type: "LEAD_CONTACT"; config: Record<string, never> }
  | { id: string; type: "BUSINESS_HOURS"; config: { mode: "INSIDE" | "OUTSIDE"; from: string; to: string } }
  | { id: string; type: "SEND_DM"; config: { text: string } }
  | { id: string; type: "SEND_PUBLIC_REPLY"; config: { text: string } }
  | { id: string; type: "SET_LEAD_NOTE"; config: { text: string } }
  | { id: string; type: "SET_LEAD_VALUE"; config: { value: number } }
  | { id: string; type: "IGNORE_MESSAGE"; config: Record<string, never> }
  | { id: string; type: "EMAIL_OWNER"; config: { text: string } }
  | { id: string; type: "WEBHOOK"; config: { url: string } }
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
  accountIds: string[]; // comptes visés ; vide = tous les comptes
  runCount: number;
  lastRunAt: string | null;
  createdAt: string;
}

export interface PipelineInput {
  name: string;
  description: string | null;
  trigger: PipelineTrigger;
  accountIds: string[];
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
