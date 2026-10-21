import type { Request } from "express";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/AppError.js";
import { getEntitlements } from "../billing/entitlements.js";

// Droits d'un membre d'équipe, module par module : consultation (read) ou modification (write).
// Un module absent des permissions n'est pas accessible.

export const TEAM_MODULES = {
  inbox: "Gestion : publications, messages privés et « À traiter »",
  automation: "Automatisation et assistant IA",
  live: "Live Manager",
  marketplace: "Marketplace",
  leads: "Lead Manager",
  schedule: "Planifier",
  stats: "Statistiques",
  history: "Historique",
  connections: "Connexions (Pages Facebook et Instagram)",
  billing: "Facturation",
} as const;

export type TeamModule = keyof typeof TEAM_MODULES;
export type Access = "read" | "write";
export type Permissions = Partial<Record<TeamModule, Access>>;

export const MODULE_IDS = Object.keys(TEAM_MODULES) as TeamModule[];

const ALL_WRITE: Permissions = Object.fromEntries(MODULE_IDS.map((m) => [m, "write"]));
const ALL_READ: Permissions = Object.fromEntries(MODULE_IDS.map((m) => [m, "read"]));

// Rôles proposés à l'invitation (modifiables ensuite module par module)
export const ROLE_PRESETS = {
  MANAGER: {
    label: "Gérant",
    description: "Tout gérer comme vous, sauf la facturation (consultation seulement).",
    permissions: { ...ALL_WRITE, billing: "read" } as Permissions,
  },
  AGENT: {
    label: "Service client",
    description: "Répond aux messages et commentaires, suit les leads ; consulte l'automatisation.",
    permissions: { inbox: "write", leads: "write", automation: "read", stats: "read", history: "read" } as Permissions,
  },
  LIVE: {
    label: "Vendeur live",
    description: "Anime les lives et traite les commandes JP, la Marketplace et les messages.",
    permissions: { live: "write", marketplace: "write", inbox: "write", leads: "read" } as Permissions,
  },
  VIEWER: {
    label: "Lecture seule",
    description: "Consulte tous les modules sans rien modifier ni envoyer.",
    permissions: ALL_READ,
  },
} as const;

export type RolePreset = keyof typeof ROLE_PRESETS | "CUSTOM";

export const roleLabel = (role: string) => (role in ROLE_PRESETS ? ROLE_PRESETS[role as keyof typeof ROLE_PRESETS].label : "Personnalisé");

// Permissions lues en base : valeurs inconnues ignorées
export function normalizePermissions(raw: unknown): Permissions {
  if (!raw || typeof raw !== "object") return {};
  const out: Permissions = {};
  for (const m of MODULE_IDS) {
    const v = (raw as Record<string, unknown>)[m];
    if (v === "read" || v === "write") out[m] = v;
  }
  return out;
}

export const allows = (perms: Permissions, module: TeamModule, level: Access) =>
  perms[module] === "write" || (level === "read" && perms[module] === "read");

// ─── Correspondance route → module ────────────────────────────────────────────

// Préfixes d'API qui portent sur les données de l'espace : un membre y agit pour le compte du propriétaire.
// Les autres (/auth, /profile, /team, /admin…) restent ceux de la personne connectée.
export const WORKSPACE_BASES = new Set([
  "/accounts", "/messages", "/workspace", "/automation", "/ai", "/history", "/facebook", "/uploads",
  "/schedules", "/lives", "/leads", "/stats", "/marketplace", "/billing",
]);

const BASE_MODULE: Record<string, TeamModule> = {
  "/messages": "inbox",
  "/workspace": "inbox",
  "/automation": "automation",
  "/ai": "automation",
  "/history": "history",
  "/schedules": "schedule",
  "/lives": "live",
  "/leads": "leads",
  "/stats": "stats",
  "/marketplace": "marketplace",
  "/billing": "billing",
};

// Droit nécessaire pour une requête : lecture pour GET, modification sinon ; null = ouvert à tout membre
export function requiredAccess(base: string, req: Pick<Request, "method" | "path">): { module: TeamModule; level: Access } | null {
  const level: Access = req.method === "GET" || req.method === "HEAD" ? "read" : "write";
  // Liste des comptes : utilisée par presque tous les écrans (sélecteurs de Page)
  if (base === "/accounts") return level === "read" ? null : { module: "connections", level };
  if (base === "/uploads") return null; // images jointes (publications, annonces, réponses)
  if (base === "/facebook") return req.path.startsWith("/connect") ? { module: "connections", level: "write" } : { module: "inbox", level };
  const module = BASE_MODULE[base];
  return module ? { module, level } : null;
}

// ─── Espace ouvert par un membre ─────────────────────────────────────────────

export interface Workspace {
  memberId: string;
  ownerId: string;
  ownerName: string;
  role: string;
  permissions: Permissions;
}

type Resolution = { ok: true; workspace: Workspace } | { ok: false; error: AppError };

// Cache court : chaque requête d'un membre le consulte ; vidé à chaque modification de l'équipe
const CACHE_MS = 15_000;
const cache = new Map<string, { at: number; value: Resolution }>();
const key = (actorId: string, ownerId: string) => `${actorId}:${ownerId}`;

export function invalidateWorkspace(actorId?: string | null) {
  if (!actorId) return cache.clear();
  for (const k of cache.keys()) if (k.startsWith(`${actorId}:`)) cache.delete(k);
}

const gone = (msg: string) => new AppError(msg, 403, "WORKSPACE_UNAVAILABLE");

// Vérifie qu'un membre peut encore travailler dans l'espace : membre actif, formule avec équipe, place dans
// la limite de la formule, propriétaire non suspendu
export async function resolveWorkspace(actorId: string, ownerId: string): Promise<Resolution> {
  const hit = cache.get(key(actorId, ownerId));
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const value = await computeWorkspace(actorId, ownerId);
  cache.set(key(actorId, ownerId), { at: Date.now(), value });
  return value;
}

async function computeWorkspace(actorId: string, ownerId: string): Promise<Resolution> {
  const m = await prisma.teamMember.findUnique({
    where: { ownerId_userId: { ownerId, userId: actorId } },
    include: { owner: { select: { name: true, companyName: true } } },
  });
  if (!m || m.status === "INVITED") return { ok: false, error: gone("Vous ne faites plus partie de cette équipe.") };
  const ownerName = m.owner.companyName?.trim() || m.owner.name;
  if (m.status === "DISABLED") return { ok: false, error: gone(`Votre accès à l'espace ${ownerName} a été suspendu par son propriétaire.`) };
  const ent = await getEntitlements(ownerId);
  if (ent.blocked) return { ok: false, error: gone(`L'espace ${ownerName} est suspendu.`) };
  if (ent.teamSeats === 0) return { ok: false, error: gone(`La formule de l'espace ${ownerName} n'inclut plus l'équipe.`) };
  if (ent.teamSeats !== null) {
    // Après un passage à une formule plus petite : seuls les premiers membres arrivés gardent l'accès
    const first = await prisma.teamMember.findMany({
      where: { ownerId, status: "ACTIVE" },
      orderBy: [{ joinedAt: "asc" }, { createdAt: "asc" }],
      take: ent.teamSeats,
      select: { id: true },
    });
    if (!first.some((f) => f.id === m.id)) {
      return { ok: false, error: gone(`L'espace ${ownerName} a atteint le nombre de membres de sa formule.`) };
    }
  }
  return {
    ok: true,
    workspace: { memberId: m.id, ownerId, ownerName, role: m.role, permissions: normalizePermissions(m.permissions) },
  };
}

// Dernière activité d'un membre : au plus une écriture par 5 minutes
const SEEN_MS = 5 * 60_000;
const lastSeen = new Map<string, number>();
export function touchMember(memberId: string) {
  const now = Date.now();
  if (now - (lastSeen.get(memberId) ?? 0) < SEEN_MS) return;
  lastSeen.set(memberId, now);
  void prisma.teamMember.update({ where: { id: memberId }, data: { lastActiveAt: new Date(now) } }).catch(() => {});
}
