import { api } from "./api";
import type { LiveProduct } from "./live.api";

// Listes d'articles des lives : tableur lu, correspondance des colonnes, jointure à une session
// (voir apps/api/src/modules/lives/list.*.ts)

type Res<T> = { status: string; data: T };

export type FieldKey = "code" | "name" | "price" | "stock";
export type Mapping = Record<FieldKey, string | null>;
export type Source = { url?: string; csv?: string };

export interface FieldInfo { key: FieldKey; label: string; required: boolean; hint: string }
export interface Issue { line: number; level: "error" | "warning"; message: string }

export interface ListRead {
  headers: string[];
  sample: string[][];
  rowCount: number;
  suggested: Mapping;
  fields: FieldInfo[];
}

export interface ListPreview { items: LiveProduct[]; issues: Issue[]; count: number; skipped: number; warnings: number }

export interface ProductList {
  id: string;
  name: string;
  sourceUrl: string | null;
  mapping: Mapping;
  headers: string[];
  itemCount: number;
  lastSyncAt: string | null;
  lastStatus: "OK" | "ERROR" | null;
  lastMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export const liveListApi = {
  read: (source: Source) => api.post<Res<ListRead>>("/lives/lists/read", { source }).then((r) => r.data),
  preview: (source: Source, mapping: Mapping) => api.post<Res<ListPreview>>("/lives/lists/preview", { source, mapping }).then((r) => r.data),
  create: (body: { name: string; source: Source; mapping: Mapping }) => api.post<Res<{ list: ProductList; issues: Issue[] }>>("/lives/lists", body).then((r) => r.data),
  list: () => api.get<Res<ProductList[]>>("/lives/lists").then((r) => r.data),
  update: (id: string, patch: { name?: string; mapping?: Mapping }) => api.patch<Res<{ list: ProductList; issues: Issue[] }>>(`/lives/lists/${id}`, patch).then((r) => r.data),
  refresh: (id: string) => api.post<Res<{ list: ProductList; issues: Issue[] }>>(`/lives/lists/${id}/refresh`).then((r) => r.data),
  items: (id: string, refresh: boolean) => api.get<Res<{ items: LiveProduct[]; refreshed: boolean; warning: string | null }>>(`/lives/lists/${id}/items${refresh ? "?refresh=1" : ""}`).then((r) => r.data),
  remove: (id: string) => api.delete<void>(`/lives/lists/${id}`),
};
