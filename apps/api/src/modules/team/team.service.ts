import { createHash, randomBytes } from "node:crypto";
import type { TeamMember } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/AppError.js";
import { getEntitlements } from "../billing/entitlements.js";
import { sendTeamInvitation } from "../mail/mail.service.js";
import {
  MODULE_IDS, ROLE_PRESETS, TEAM_MODULES, invalidateWorkspace, normalizePermissions, resolveWorkspace, roleLabel,
  type Permissions, type RolePreset,
} from "./team.access.js";

export interface CurrentWorkspace {
  ownerId: string;
  space: string;
  role: string;
  roleLabel: string;
  permissions: Permissions;
}

const INVITE_DAYS = 7;
const DAY = 86_400_000;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const inviteUrl = (token: string) => `${env.clientUrl}/invitation/${token}`;
const spaceName = (u: { name: string; companyName: string | null }) => u.companyName?.trim() || u.name;

// Nouveau lien d'invitation : seule son empreinte est gardée en base
function newInvite() {
  const token = randomBytes(24).toString("base64url");
  return { token, data: { inviteTokenHash: hashToken(token), inviteExpiresAt: new Date(Date.now() + INVITE_DAYS * DAY) } };
}

type MemberRow = TeamMember & { user: { name: string; email: string; avatarUrl: string | null } | null };

function publicMember(m: MemberRow) {
  return {
    id: m.id,
    email: m.email,
    name: m.user?.name ?? m.name,
    avatarUrl: m.user?.avatarUrl ?? null,
    role: m.role,
    roleLabel: roleLabel(m.role),
    permissions: normalizePermissions(m.permissions),
    status: m.status as "INVITED" | "ACTIVE" | "DISABLED",
    inviteExpired: m.status === "INVITED" && Boolean(m.inviteExpiresAt && m.inviteExpiresAt < new Date()),
    inviteExpiresAt: m.inviteExpiresAt,
    joinedAt: m.joinedAt,
    lastActiveAt: m.lastActiveAt,
    createdAt: m.createdAt,
  };
}

const memberInclude = { user: { select: { name: true, email: true, avatarUrl: true } } } as const;

async function log(userId: string, action: string, meta: Record<string, unknown>) {
  await prisma.activityLog.create({ data: { userId, action, meta: meta as object } });
}

// Ce qui est envoyé au navigateur pour construire les écrans (libellés des modules et rôles)
export function teamCatalog() {
  return {
    modules: MODULE_IDS.map((id) => ({ id, label: TEAM_MODULES[id] })),
    presets: Object.entries(ROLE_PRESETS).map(([id, p]) => ({ id, label: p.label, description: p.description, permissions: p.permissions })),
  };
}

async function sendInvite(owner: { name: string; companyName: string | null }, m: TeamMember, token: string) {
  try {
    await sendTeamInvitation(m.email, { inviter: owner.name, space: spaceName(owner), role: roleLabel(m.role), url: inviteUrl(token), days: INVITE_DAYS });
    return true;
  } catch (e) {
    console.error(`❌ Invitation ${m.email} non envoyée :`, (e as Error).message);
    return false;
  }
}

export const teamService = {
  // ─── Propriétaire : son équipe ─────────────────────────────────────────────
  async overview(ownerId: string) {
    const [ent, members] = await Promise.all([
      getEntitlements(ownerId),
      prisma.teamMember.findMany({ where: { ownerId }, include: memberInclude, orderBy: { createdAt: "asc" } }),
    ]);
    const used = members.filter((m) => m.status !== "DISABLED").length;
    return {
      seats: ent.teamSeats, // null = illimité, 0 = formule sans équipe
      used,
      planName: ent.planName,
      members: members.map(publicMember),
      ...teamCatalog(),
    };
  },

  async invite(ownerId: string, input: { email: string; name?: string; role: RolePreset; permissions: Permissions }) {
    const email = input.email.trim().toLowerCase();
    const owner = await prisma.user.findUniqueOrThrow({ where: { id: ownerId }, select: { name: true, email: true, companyName: true } });
    if (email === owner.email.toLowerCase()) throw new AppError("Vous faites déjà partie de votre espace.", 400);
    const ent = await getEntitlements(ownerId);
    if (ent.teamSeats === 0) throw new AppError(`La formule ${ent.planName} n'inclut pas l'équipe : passez à la formule Business pour inviter des membres.`, 402, "PLAN_REQUIRED");

    const existing = await prisma.teamMember.findUnique({ where: { ownerId_email: { ownerId, email } } });
    if (existing?.status === "ACTIVE") throw new AppError("Cette personne fait déjà partie de votre équipe.", 409);
    if (!existing || existing.status === "DISABLED") {
      const used = await prisma.teamMember.count({ where: { ownerId, status: { not: "DISABLED" } } });
      if (ent.teamSeats !== null && used >= ent.teamSeats) {
        throw new AppError(`Votre formule permet ${ent.teamSeats} membres : retirez-en un ou passez à la formule Agence.`, 402, "TEAM_LIMIT");
      }
    }
    const permissions = normalizePermissions(input.permissions);
    if (!Object.keys(permissions).length) throw new AppError("Donnez accès à au moins un module.", 400);

    const { token, data } = newInvite();
    const fields = { name: input.name?.trim() || null, role: input.role, permissions: permissions as object, ...data };
    const m = await prisma.teamMember.upsert({
      where: { ownerId_email: { ownerId, email } },
      create: { ownerId, email, status: "INVITED", ...fields },
      update: { ...fields, status: "INVITED", userId: null, joinedAt: null }, // ancien membre suspendu : nouvelle invitation
      include: memberInclude,
    });
    invalidateWorkspace(existing?.userId);
    const emailSent = await sendInvite(owner, m, token);
    await log(ownerId, "TEAM_MEMBER_INVITED", { email, role: input.role });
    return { member: publicMember(m), inviteUrl: inviteUrl(token), emailSent };
  },

  async update(ownerId: string, memberId: string, input: { role?: RolePreset; permissions?: Permissions; status?: "ACTIVE" | "DISABLED" }) {
    const m = await prisma.teamMember.findFirst({ where: { id: memberId, ownerId } });
    if (!m) throw new AppError("Membre introuvable", 404);
    const data: Record<string, unknown> = {};
    if (input.role) data.role = input.role;
    if (input.permissions) {
      const p = normalizePermissions(input.permissions);
      if (!Object.keys(p).length) throw new AppError("Donnez accès à au moins un module.", 400);
      data.permissions = p;
    }
    if (input.status) {
      if (m.status === "INVITED") throw new AppError("Invitation en attente : retirez-la plutôt que de la suspendre.", 400);
      if (input.status === "ACTIVE" && m.status === "DISABLED") {
        const ent = await getEntitlements(ownerId);
        const used = await prisma.teamMember.count({ where: { ownerId, status: { not: "DISABLED" } } });
        if (ent.teamSeats !== null && used >= ent.teamSeats) throw new AppError(`Votre formule permet ${ent.teamSeats} membres.`, 402, "TEAM_LIMIT");
      }
      data.status = input.status;
    }
    const updated = await prisma.teamMember.update({ where: { id: m.id }, data, include: memberInclude });
    invalidateWorkspace(m.userId);
    await log(ownerId, input.status ? (input.status === "DISABLED" ? "TEAM_MEMBER_DISABLED" : "TEAM_MEMBER_ENABLED") : "TEAM_MEMBER_UPDATED", {
      email: m.email,
      role: updated.role,
    });
    return publicMember(updated);
  },

  async resend(ownerId: string, memberId: string) {
    const m = await prisma.teamMember.findFirst({ where: { id: memberId, ownerId } });
    if (!m) throw new AppError("Membre introuvable", 404);
    if (m.status !== "INVITED") throw new AppError("Cette personne a déjà rejoint l'équipe.", 400);
    const owner = await prisma.user.findUniqueOrThrow({ where: { id: ownerId }, select: { name: true, companyName: true } });
    const { token, data } = newInvite();
    const updated = await prisma.teamMember.update({ where: { id: m.id }, data, include: memberInclude });
    const emailSent = await sendInvite(owner, updated, token);
    return { member: publicMember(updated), inviteUrl: inviteUrl(token), emailSent };
  },

  async remove(ownerId: string, memberId: string) {
    const m = await prisma.teamMember.findFirst({ where: { id: memberId, ownerId } });
    if (!m) throw new AppError("Membre introuvable", 404);
    await prisma.teamMember.delete({ where: { id: m.id } });
    if (m.userId) await prisma.user.updateMany({ where: { id: m.userId, activeOwnerId: ownerId }, data: { activeOwnerId: null } });
    invalidateWorkspace(m.userId);
    await log(ownerId, m.status === "INVITED" ? "TEAM_INVITE_CANCELLED" : "TEAM_MEMBER_REMOVED", { email: m.email });
    return { ok: true };
  },

  // ─── Membre : espaces rejoints et invitations reçues ───────────────────────
  async memberships(userId: string) {
    const me = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, activeOwnerId: true } });
    const rows = await prisma.teamMember.findMany({
      where: { OR: [{ userId }, { email: me.email.toLowerCase(), status: "INVITED" }] },
      include: { owner: { select: { name: true, companyName: true, avatarUrl: true } } },
      orderBy: { createdAt: "asc" },
    });
    const now = new Date();
    return rows
      .filter((r) => r.status !== "INVITED" || !r.inviteExpiresAt || r.inviteExpiresAt > now)
      .map((r) => ({
        id: r.id,
        ownerId: r.ownerId,
        space: spaceName(r.owner),
        ownerName: r.owner.name,
        ownerAvatarUrl: r.owner.avatarUrl,
        role: r.role,
        roleLabel: roleLabel(r.role),
        permissions: normalizePermissions(r.permissions),
        status: r.status as "INVITED" | "ACTIVE" | "DISABLED",
        current: me.activeOwnerId === r.ownerId,
      }));
  },

  // Aperçu public d'une invitation (page /invitation/:token)
  async invitation(token: string) {
    const m = await prisma.teamMember.findUnique({
      where: { inviteTokenHash: hashToken(token) },
      include: { owner: { select: { name: true, companyName: true, avatarUrl: true } } },
    });
    if (!m) throw new AppError("Invitation introuvable : elle a peut-être été annulée ou déjà utilisée.", 404, "INVITE_NOT_FOUND");
    return {
      email: m.email,
      space: spaceName(m.owner),
      ownerName: m.owner.name,
      ownerAvatarUrl: m.owner.avatarUrl,
      roleLabel: roleLabel(m.role),
      permissions: normalizePermissions(m.permissions),
      expired: Boolean(m.inviteExpiresAt && m.inviteExpiresAt < new Date()),
      modules: teamCatalog().modules,
    };
  },

  // Acceptation : par le lien reçu (token) ou depuis la liste des invitations de l'application (memberId)
  async accept(userId: string, ref: { token?: string; memberId?: string }) {
    const me = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, name: true } });
    const m = ref.token
      ? await prisma.teamMember.findUnique({ where: { inviteTokenHash: hashToken(ref.token) } })
      : await prisma.teamMember.findFirst({ where: { id: ref.memberId, status: "INVITED" } });
    if (!m || m.status !== "INVITED") throw new AppError("Invitation introuvable : elle a peut-être été annulée ou déjà utilisée.", 404, "INVITE_NOT_FOUND");
    if (m.inviteExpiresAt && m.inviteExpiresAt < new Date()) throw new AppError("Invitation expirée : demandez-en une nouvelle.", 410, "INVITE_EXPIRED");
    if (m.email !== me.email.toLowerCase()) {
      throw new AppError(`Cette invitation est destinée à ${m.email} : connectez-vous avec cette adresse.`, 403, "INVITE_EMAIL_MISMATCH");
    }
    if (m.ownerId === userId) throw new AppError("Vous ne pouvez pas rejoindre votre propre espace.", 400);
    await prisma.$transaction([
      prisma.teamMember.update({ where: { id: m.id }, data: { userId, status: "ACTIVE", joinedAt: new Date(), inviteTokenHash: null, inviteExpiresAt: null } }),
      prisma.user.update({ where: { id: userId }, data: { activeOwnerId: m.ownerId } }), // l'espace rejoint s'ouvre tout de suite
      prisma.activityLog.create({ data: { userId: m.ownerId, action: "TEAM_MEMBER_JOINED", actorId: userId, actorName: me.name, meta: { email: m.email, role: m.role } } }),
    ]);
    invalidateWorkspace(userId);
    return { ownerId: m.ownerId };
  },

  async decline(userId: string, memberId: string) {
    const me = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, name: true } });
    const m = await prisma.teamMember.findFirst({ where: { id: memberId, status: "INVITED", email: me.email.toLowerCase() } });
    if (!m) throw new AppError("Invitation introuvable", 404);
    await prisma.teamMember.delete({ where: { id: m.id } });
    await prisma.activityLog.create({ data: { userId: m.ownerId, action: "TEAM_INVITE_DECLINED", actorId: userId, actorName: me.name, meta: { email: m.email } } });
    return { ok: true };
  },

  async leave(userId: string, ownerId: string) {
    const m = await prisma.teamMember.findUnique({ where: { ownerId_userId: { ownerId, userId } } });
    if (!m) throw new AppError("Vous ne faites pas partie de cette équipe.", 404);
    const me = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true } });
    await prisma.teamMember.delete({ where: { id: m.id } });
    await prisma.user.updateMany({ where: { id: userId, activeOwnerId: ownerId }, data: { activeOwnerId: null } });
    await prisma.activityLog.create({ data: { userId: ownerId, action: "TEAM_MEMBER_LEFT", actorId: userId, actorName: me.name, meta: { email: m.email } } });
    invalidateWorkspace(userId);
    return { ok: true };
  },

  // Espace ouvert : celui d'une équipe rejointe, ou le sien (null)
  async switchTo(userId: string, ownerId: string | null) {
    if (ownerId && ownerId !== userId) {
      invalidateWorkspace(userId);
      const r = await resolveWorkspace(userId, ownerId);
      if (!r.ok) throw r.error;
    }
    await prisma.user.update({ where: { id: userId }, data: { activeOwnerId: ownerId && ownerId !== userId ? ownerId : null } });
    invalidateWorkspace(userId);
    return { ok: true };
  },

  // Espace en cours, pour /auth/me : workspace null si la personne travaille dans le sien ;
  // unavailable : l'espace ouvert n'est plus accessible (accès retiré depuis), avec la raison
  async currentWorkspace(userId: string, activeOwnerId: string | null): Promise<{ workspace: CurrentWorkspace | null; unavailable: string | null }> {
    if (!activeOwnerId || activeOwnerId === userId) return { workspace: null, unavailable: null };
    const r = await resolveWorkspace(userId, activeOwnerId);
    if (!r.ok) return { workspace: null, unavailable: r.error.message };
    const w = r.workspace;
    return { workspace: { ownerId: w.ownerId, space: w.ownerName, role: w.role, roleLabel: roleLabel(w.role), permissions: w.permissions }, unavailable: null };
  },
};
