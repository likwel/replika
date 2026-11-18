import type { Lead, Prisma, SocialAccount, SocialMessage } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { graphClient, graphErrorMessage } from "../facebook/graph.client.js";
import { sendMail } from "../mail/mail.service.js";
import { assertPublicUrl } from "../schedules/import.fetch.js";
import { firstName, renderReply } from "../autoreply/autoreply.matcher.js";
import { appliesTo, checkCondition, isCondition, stepLabel, subjectOf, type ConditionContext, type TraceEntry } from "./pipeline.logic.js";
import { stepSchema, type PipelineStep } from "./pipeline.schema.js";

type Trigger = "NEW_COMMENT" | "NEW_MESSAGE" | "NEW_LEAD" | "HOT_LEAD";
const HOT_SCORE = 70;

// Déclencheurs que fait naître un message (et son lead, s'il y en a un)
export function triggersFor(msg: Pick<SocialMessage, "kind">, lead: Pick<Lead, "score" | "messageCount"> | null): Trigger[] {
  const out: Trigger[] = [msg.kind === "DIRECT" ? "NEW_MESSAGE" : "NEW_COMMENT"];
  if (lead && lead.messageCount === 1) out.push("NEW_LEAD");
  if (lead && lead.score >= HOT_SCORE) out.push("HOT_LEAD");
  return out;
}

// Point d'entrée, appelé après le traitement d'un message : exécute les pipelines actifs concernés.
// Ne lève jamais d'erreur : un pipeline en échec ne doit pas gêner les réponses automatiques.
export async function runPipelinesFor(account: SocialAccount, msg: SocialMessage, lead: Lead | null): Promise<void> {
  try {
    const owner = await prisma.user.findUnique({ where: { id: account.userId }, select: { autoReplyEnabled: true } });
    if (!owner?.autoReplyEnabled) return; // l'interrupteur général met aussi les pipelines en pause

    const triggers = triggersFor(msg, lead);
    const pipelines = await prisma.pipeline.findMany({ where: { userId: account.userId, isActive: true, trigger: { in: triggers } } });
    for (const p of pipelines) {
      if (!appliesTo(p, { trigger: p.trigger, accountId: account.id })) continue;
      await runOne(p, account, msg, lead).catch((e) => console.error(`❌ Pipeline « ${p.name} » :`, e));
    }
  } catch (e) {
    console.error("❌ Pipelines :", e);
  }
}

interface PipelineRow {
  id: string;
  name: string;
  userId: string;
  steps: Prisma.JsonValue;
}

async function runOne(p: PipelineRow, account: SocialAccount, msg: SocialMessage, lead: Lead | null) {
  const parsed = stepSchema.array().safeParse(p.steps);
  const trace: TraceEntry[] = [];
  let status: "SUCCESS" | "STOPPED" | "FAILED" = "SUCCESS";
  let error: string | null = null;

  if (!parsed.success) {
    status = "FAILED";
    error = "Les étapes de ce pipeline sont invalides : ouvrez-le et enregistrez-le de nouveau.";
  } else {
    const steps = parsed.data;
    const ruleIds = steps.flatMap((s) => (s.type === "MATCH_RULE" ? [s.config.ruleId] : []));
    const rules = ruleIds.length ? await prisma.automationRule.findMany({ where: { userId: p.userId, id: { in: ruleIds } } }) : [];
    const ctx: ConditionContext = {
      text: msg.content,
      kind: msg.kind === "DIRECT" ? "DIRECT" : "COMMENT", // un commentaire de live se traite comme un commentaire
      leadScore: lead?.score ?? null,
      platform: account.platform,
      lead: lead ? { status: lead.status, intent: lead.intent, phone: lead.phone, email: lead.email } : null,
      now: new Date(),
      rules: new Map(rules.map((r) => [r.id, r])),
    };

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const label = stepLabel(step, step.type === "MATCH_RULE" ? ctx.rules.get(step.config.ruleId)?.name : undefined);
      if (isCondition(step.type)) {
        const r = checkCondition(step, ctx);
        if (r.pass) {
          trace.push({ stepId: step.id, type: step.type, label, status: "ok" });
          continue;
        }
        trace.push({ stepId: step.id, type: step.type, label, status: "failed", detail: r.reason });
        steps.slice(i + 1).forEach((s) => trace.push({ stepId: s.id, type: s.type, label: stepLabel(s), status: "skipped" }));
        status = "STOPPED";
        break;
      }
      try {
        const detail = await doAction(step, account, msg, lead, p.name);
        trace.push({ stepId: step.id, type: step.type, label, status: "ok", detail });
      } catch (e) {
        trace.push({ stepId: step.id, type: step.type, label, status: "failed", detail: e instanceof Error ? e.message : "Échec" });
        steps.slice(i + 1).forEach((s) => trace.push({ stepId: s.id, type: s.type, label: stepLabel(s), status: "skipped" }));
        status = "FAILED";
        error = e instanceof Error ? e.message : "Échec";
        break;
      }
    }
  }

  // Une condition non remplie est le cas normal (le pipeline ne concerne pas ce message) : on ne la compte pas comme une exécution
  if (status === "STOPPED") return;
  await prisma.$transaction([
    prisma.pipelineRun.create({
      data: { pipelineId: p.id, userId: p.userId, status, subject: subjectOf(msg.authorName, msg.content), trace: trace as unknown as Prisma.InputJsonValue, error },
    }),
    prisma.pipeline.update({ where: { id: p.id }, data: { runCount: { increment: 1 }, lastRunAt: new Date() } }),
  ]);
}

// Exécute une action ; renvoie un détail lisible pour la trace
async function doAction(step: PipelineStep, account: SocialAccount, msg: SocialMessage, lead: Lead | null, pipelineName: string): Promise<string | undefined> {
  switch (step.type) {
    case "SEND_DM": {
      const text = renderReply(step.config.text, { nom: firstName(msg.authorName), page: account.name });
      try {
        if (msg.kind === "DIRECT") {
          if (!msg.authorId) throw new Error("Destinataire inconnu");
          await graphClient.sendMessage(msg.authorId, text, account.accessToken);
        } else {
          await graphClient.sendPrivateReply(msg.externalId, text, account.accessToken);
        }
      } catch (e) {
        throw new Error(`Message privé non envoyé : ${graphErrorMessage(e)}`);
      }
      return "Message envoyé";
    }
    case "SET_LEAD_STATUS": {
      if (!lead) return "Aucun lead pour ce message : rien à changer";
      await prisma.lead.update({ where: { id: lead.id }, data: { status: step.config.status } });
      return undefined;
    }
    case "ESCALATE": {
      await prisma.socialMessage.update({ where: { id: msg.id }, data: { status: "ESCALATED" } });
      return undefined;
    }
    case "SEND_PUBLIC_REPLY": {
      if (msg.kind === "DIRECT") return "Message privé : pas de réponse publique possible";
      const text = renderReply(step.config.text, { nom: firstName(msg.authorName), page: account.name });
      try {
        if (account.platform === "INSTAGRAM") await graphClient.replyToInstagramComment(msg.externalId, text, account.accessToken);
        else await graphClient.replyToComment(msg.externalId, text, account.accessToken);
      } catch (e) {
        throw new Error(`Réponse publique non envoyée : ${graphErrorMessage(e)}`);
      }
      return "Réponse publiée";
    }
    case "SET_LEAD_NOTE": {
      if (!lead) return "Aucun lead pour ce message : rien à noter";
      const note = [lead.note, step.config.text].filter(Boolean).join("\n").slice(-1000);
      await prisma.lead.update({ where: { id: lead.id }, data: { note } });
      return undefined;
    }
    case "SET_LEAD_VALUE": {
      if (!lead) return "Aucun lead pour ce message : rien à estimer";
      await prisma.lead.update({ where: { id: lead.id }, data: { value: step.config.value } });
      return undefined;
    }
    case "IGNORE_MESSAGE": {
      await prisma.socialMessage.update({ where: { id: msg.id }, data: { status: "IGNORED" } });
      return undefined;
    }
    case "EMAIL_OWNER": {
      const owner = await prisma.user.findUnique({ where: { id: account.userId }, select: { email: true, name: true } });
      if (!owner) throw new Error("Propriétaire introuvable");
      const excerpt = msg.content.replace(/\s+/g, " ").trim().slice(0, 200);
      const text = `${step.config.text}\n\nCompte : ${account.name}\nDe : ${msg.authorName}\nMessage : ${excerpt}\n\nPipeline « ${pipelineName} » · SuiteFlow`;
      const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
      const html = `<div style="font-family:Inter,Arial,sans-serif;max-width:480px;color:#111B21"><p style="font-size:15px">${esc(step.config.text)}</p><p style="font-size:13px;color:#54656F">Compte : ${esc(account.name)}<br>De : ${esc(msg.authorName)}<br>Message : ${esc(excerpt)}</p><p style="font-size:12px;color:#54656F">Pipeline « ${esc(pipelineName)} » · SuiteFlow</p></div>`;
      try {
        await sendMail(owner.email, `SuiteFlow · ${pipelineName}`, text, html);
      } catch (e) {
        throw new Error(`E-mail non envoyé : ${e instanceof Error ? e.message : "échec"}`);
      }
      return "E-mail envoyé";
    }
    case "WEBHOOK": {
      // Adresse choisie par l'utilisateur : refusée si elle n'est pas publique (SSRF), sans redirection, durée limitée
      const url = await assertPublicUrl(step.config.url);
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 8000);
      try {
        const res = await fetch(url, {
          method: "POST",
          redirect: "error",
          signal: ctl.signal,
          headers: { "Content-Type": "application/json", "User-Agent": "SuiteFlow-Pipeline/1.0" },
          body: JSON.stringify({
            pipeline: pipelineName,
            account: { id: account.id, name: account.name, platform: account.platform },
            message: { id: msg.id, kind: msg.kind, author: msg.authorName, text: msg.content },
            lead: lead ? { id: lead.id, name: lead.name, score: lead.score, status: lead.status, intent: lead.intent, phone: lead.phone, email: lead.email } : null,
          }),
        });
        if (!res.ok) throw new Error(`réponse ${res.status}`);
      } catch (e) {
        throw new Error(`Adresse web non jointe : ${e instanceof Error ? e.message : "échec"}`);
      } finally {
        clearTimeout(timer);
      }
      return "Envoyé";
    }
    case "NOTIFY": {
      await prisma.activityLog.create({
        data: { userId: account.userId, action: "PIPELINE_NOTE", meta: { text: step.config.text, messageId: msg.id, author: msg.authorName } },
      });
      return undefined;
    }
    default:
      return undefined;
  }
}
