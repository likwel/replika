import crypto from "node:crypto";
import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { graphClient } from "../facebook/graph.client.js";
import { handleIncoming, type IncomingEvent } from "../autoreply/autoreply.engine.js";

type MetaPlatform = "FACEBOOK" | "INSTAGRAM";

// Structure (partielle) des notifications Meta
interface MessagingEvent {
  sender?: { id: string };
  message?: { mid: string; text?: string; is_echo?: boolean };
  timestamp?: number;
}

interface ChangeEvent {
  field: string;
  value: {
    // Page Facebook (field "feed")
    item?: string;
    verb?: string;
    comment_id?: string;
    post_id?: string;
    message?: string;
    created_time?: number;
    // Instagram (field "comments" / "live_comments")
    id?: string;
    text?: string;
    media?: { id: string };
    from?: { id: string; name?: string; username?: string };
  };
}

interface WebhookPayload {
  object?: string;
  entry?: Array<{ id: string; changes?: ChangeEvent[]; messaging?: MessagingEvent[] }>;
}

// Vérifie l'en-tête X-Hub-Signature-256 (HMAC SHA-256 du corps brut avec le secret de l'app)
export function isValidSignature(rawBody: Buffer | undefined, header: string | undefined): boolean {
  if (!rawBody || !header?.startsWith("sha256=") || !env.fb.appSecret) return false;
  const expected = crypto.createHmac("sha256", env.fb.appSecret).update(rawBody).digest("hex");
  const received = header.slice("sha256=".length);
  return (
    expected.length === received.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received))
  );
}

function changeToEvent(platform: MetaPlatform, change: ChangeEvent): IncomingEvent | null {
  const v = change.value;

  if (platform === "FACEBOOK") {
    if (change.field !== "feed" || v.item !== "comment" || v.verb !== "add" || !v.comment_id) return null;
    return {
      kind: "COMMENT",
      externalId: v.comment_id,
      authorId: v.from?.id,
      authorName: v.from?.name ?? "Utilisateur Facebook",
      content: v.message ?? "",
      postId: v.post_id,
      createdAt: v.created_time ? new Date(v.created_time * 1000) : undefined,
    };
  }

  if (!["comments", "live_comments"].includes(change.field) || !v.id) return null;
  return {
    kind: "COMMENT",
    externalId: v.id,
    authorId: v.from?.id,
    authorName: v.from?.username ?? "Utilisateur Instagram",
    content: v.text ?? "",
    postId: v.media?.id,
  };
}

function messagingToEvent(m: MessagingEvent): IncomingEvent | null {
  if (!m.message?.mid || m.message.is_echo || !m.message.text || !m.sender?.id) return null;
  return {
    kind: "DIRECT",
    externalId: m.message.mid,
    authorId: m.sender.id,
    authorName: "",
    content: m.message.text,
    createdAt: m.timestamp ? new Date(m.timestamp) : undefined,
  };
}

// Le nom de l'expéditeur n'est pas inclus dans les webhooks de messagerie
async function resolveAuthorName(ev: IncomingEvent, platform: MetaPlatform, pageToken: string) {
  if (ev.authorName) return ev.authorName;
  const fallback = platform === "INSTAGRAM" ? "Utilisateur Instagram" : "Utilisateur Messenger";
  if (!ev.authorId) return fallback;
  const name = await graphClient.getSenderName(ev.authorId, platform, pageToken).catch(() => null);
  return name ?? fallback;
}

export async function processWebhook(payload: WebhookPayload) {
  const platform: MetaPlatform | null =
    payload.object === "page" ? "FACEBOOK" : payload.object === "instagram" ? "INSTAGRAM" : null;
  if (!platform) return;

  for (const entry of payload.entry ?? []) {
    // Une même Page peut être liée par plusieurs utilisateurs de ReplyKA
    const accounts = await prisma.socialAccount.findMany({
      where: { platform, externalId: entry.id, isActive: true },
    });
    if (!accounts.length) continue;

    const events = [
      ...(entry.changes ?? []).map((c) => changeToEvent(platform, c)),
      ...(entry.messaging ?? []).map(messagingToEvent),
    ].filter((e): e is IncomingEvent => e !== null);

    for (const ev of events) {
      for (const acc of accounts) {
        try {
          await handleIncoming(acc, { ...ev, authorName: await resolveAuthorName(ev, platform, acc.accessToken) });
        } catch (e) {
          console.error(`❌ Webhook ${ev.externalId} :`, e);
        }
      }
    }
  }
}
