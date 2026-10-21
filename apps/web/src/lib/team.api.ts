import { api } from "./api";

// Équipe : membres de mon espace, espaces rejoints, invitations

export type TeamModule = "inbox" | "automation" | "live" | "marketplace" | "leads" | "schedule" | "stats" | "history" | "connections" | "billing";
export type Access = "read" | "write";
export type Permissions = Partial<Record<TeamModule, Access>>;
export type MemberStatus = "INVITED" | "ACTIVE" | "DISABLED";

export interface RolePreset {
  id: string;
  label: string;
  description: string;
  permissions: Permissions;
}

export interface TeamMember {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: string;
  roleLabel: string;
  permissions: Permissions;
  status: MemberStatus;
  inviteExpired: boolean;
  inviteExpiresAt: string | null;
  joinedAt: string | null;
  lastActiveAt: string | null;
  createdAt: string;
}

export interface TeamOverview {
  seats: number | null; // null = illimité, 0 = formule sans équipe
  used: number;
  planName: string;
  members: TeamMember[];
  modules: Array<{ id: TeamModule; label: string }>;
  presets: RolePreset[];
}

export interface Membership {
  id: string;
  ownerId: string;
  space: string;
  ownerName: string;
  ownerAvatarUrl: string | null;
  role: string;
  roleLabel: string;
  permissions: Permissions;
  status: MemberStatus;
  current: boolean;
}

export interface InvitationPreview {
  email: string;
  space: string;
  ownerName: string;
  ownerAvatarUrl: string | null;
  roleLabel: string;
  permissions: Permissions;
  expired: boolean;
  modules: Array<{ id: TeamModule; label: string }>;
}

export interface InviteResult {
  member: TeamMember;
  inviteUrl: string;
  emailSent: boolean;
}

type Res<T> = { status: string; data: T };

export const teamApi = {
  overview: () => api.get<Res<TeamOverview>>("/team").then((r) => r.data),
  invite: (body: { email: string; name?: string; role: string; permissions: Permissions }) =>
    api.post<Res<InviteResult>>("/team/members", body).then((r) => r.data),
  update: (id: string, body: { role?: string; permissions?: Permissions; status?: "ACTIVE" | "DISABLED" }) =>
    api.patch<Res<TeamMember>>(`/team/members/${id}`, body).then((r) => r.data),
  resend: (id: string) => api.post<Res<InviteResult>>(`/team/members/${id}/resend`).then((r) => r.data),
  remove: (id: string) => api.delete<Res<{ ok: true }>>(`/team/members/${id}`).then((r) => r.data),

  memberships: () => api.get<Res<Membership[]>>("/team/memberships").then((r) => r.data),
  invitation: (token: string) => api.get<Res<InvitationPreview>>(`/team/invitations/${encodeURIComponent(token)}`).then((r) => r.data),
  acceptToken: (token: string) => api.post<Res<{ ownerId: string }>>(`/team/invitations/${encodeURIComponent(token)}/accept`).then((r) => r.data),
  accept: (id: string) => api.post<Res<{ ownerId: string }>>(`/team/memberships/${id}/accept`).then((r) => r.data),
  decline: (id: string) => api.post<Res<{ ok: true }>>(`/team/memberships/${id}/decline`).then((r) => r.data),
  leave: (ownerId: string) => api.delete<Res<{ ok: true }>>(`/team/spaces/${ownerId}`).then((r) => r.data),
  switchTo: (ownerId: string | null) => api.post<Res<{ ok: true }>>("/team/switch", { ownerId }).then((r) => r.data),
};

// Ouvre un espace (le sien : null) : rechargement complet, aucune donnée de l'espace précédent ne reste affichée
export async function openSpace(ownerId: string | null, path = "/app") {
  await teamApi.switchTo(ownerId);
  window.location.assign(path);
}

// Libellés courts (pastilles, résumés) ; les libellés complets viennent de l'API (catalogue des modules)
export const MODULE_SHORT: Record<TeamModule, string> = {
  inbox: "Gestion",
  automation: "Automatisation",
  live: "Live Manager",
  marketplace: "Marketplace",
  leads: "Leads",
  schedule: "Planifier",
  stats: "Statistiques",
  history: "Historique",
  connections: "Connexions",
  billing: "Facturation",
};

export const ACCESS_LABEL: Record<Access, string> = { read: "Lecture", write: "Modification" };
