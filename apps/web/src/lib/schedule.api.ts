import { api, ApiError, BASE_URL } from "./api";
import type { MetaPlatform } from "./workspace.api";

export type ScheduleKind = "POST" | "COMMENT" | "MESSAGE";
export type ScheduleStatus = "DRAFT" | "SCHEDULED" | "PUBLISHING" | "DONE" | "PARTIAL" | "FAILED";
export type MessageTag = "POST_PURCHASE_UPDATE" | "CONFIRMED_EVENT_UPDATE" | "ACCOUNT_UPDATE";

export interface ScheduleTarget {
  id: string;
  accountId: string;
  refId: string | null;
  label: string | null;
  status: "PENDING" | "DONE" | "FAILED";
  externalId: string | null;
  permalink: string | null;
  error: string | null;
  doneAt: string | null;
  account: { id: string; name: string; platform: MetaPlatform; avatarUrl: string | null };
}

export interface Schedule {
  id: string;
  kind: ScheduleKind;
  status: ScheduleStatus;
  text: string;
  imageUrl: string | null;
  link: string | null;
  messageTag: MessageTag | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  error: string | null;
  targets: ScheduleTarget[];
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleInput {
  kind: ScheduleKind;
  text: string;
  imageUrl?: string | null;
  link?: string | null;
  messageTag?: MessageTag | null;
  scheduledAt?: string | null;
  status: "DRAFT" | "SCHEDULED";
  publishNow?: boolean;
  targets: Array<{ accountId: string; refId?: string | null; label?: string | null }>;
}

type Res<T> = { status: string; data: T };
type Saved = { schedule: Schedule; warnings: string[] };

export const scheduleApi = {
  list: (params: { from?: string; to?: string; status?: ScheduleStatus[]; kind?: ScheduleKind } = {}) => {
    const q = new URLSearchParams();
    if (params.from) q.set("from", params.from);
    if (params.to) q.set("to", params.to);
    if (params.status?.length) q.set("status", params.status.join(","));
    if (params.kind) q.set("kind", params.kind);
    const qs = q.toString();
    return api.get<Res<Schedule[]>>(`/schedules${qs ? `?${qs}` : ""}`).then((r) => r.data);
  },
  get: (id: string) => api.get<Res<Schedule>>(`/schedules/${id}`).then((r) => r.data),
  create: (body: ScheduleInput) => api.post<Res<Saved>>("/schedules", body).then((r) => r.data),
  update: (id: string, body: ScheduleInput) => api.put<Res<Saved>>(`/schedules/${id}`, body).then((r) => r.data),
  publish: (id: string) => api.post<Res<Schedule>>(`/schedules/${id}/publish`).then((r) => r.data),
  remove: (id: string) => api.delete<void>(`/schedules/${id}`),
};

// Envoi binaire de l'image (déjà compressée en JPEG par le navigateur)
export async function uploadImage(blob: Blob): Promise<{ url: string; name: string }> {
  const res = await fetch(`${BASE_URL}/uploads`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": blob.type || "image/jpeg" },
    body: blob,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(json?.message ?? "Envoi de l'image impossible", res.status);
  return json.data;
}
