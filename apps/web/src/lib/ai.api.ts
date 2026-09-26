import { api } from "./api";
import type { RuleChannel } from "./automation.api";

export type Intent =
  | "prix"
  | "commande"
  | "livraison"
  | "disponibilite"
  | "question"
  | "reclamation"
  | "compliment"
  | "spam"
  | "autre";

export interface AiAccount {
  id: string;
  name: string;
  platform: "FACEBOOK" | "INSTAGRAM" | "TIKTOK";
  avatarUrl: string | null;
  isActive: boolean;
  aiEnabled: boolean;
  aiAutoSend: boolean;
  aiChannel: RuleChannel;
  aiContext: string | null;
  aiInstructions: string | null;
}

export type AiAccountInput = Partial<
  Pick<AiAccount, "aiEnabled" | "aiAutoSend" | "aiChannel" | "aiContext" | "aiInstructions">
>;

export interface AiOverview {
  configured: boolean;
  provider: string;
  model: string;
  lastError: { message: string; at: string } | null;
  accounts: AiAccount[];
}

export interface AiReply {
  reply: string;
  intent: Intent;
  needsHuman: boolean;
}

type Res<T> = { status: string; data: T };

export const aiApi = {
  overview: () => api.get<Res<AiOverview>>("/ai").then((r) => r.data),

  updateAccount: (id: string, body: AiAccountInput) =>
    api.patch<Res<AiAccount>>(`/ai/accounts/${id}`, body).then((r) => r.data),

  // Génère une réponse sans rien publier (avec le brouillon de configuration)
  test: (body: {
    accountId: string;
    text: string;
    kind: "COMMENT" | "DIRECT";
    aiContext?: string | null;
    aiInstructions?: string | null;
  }) => api.post<Res<AiReply>>("/ai/test", body).then((r) => r.data),
};

export const INTENT_META: Record<Intent, { label: string; tone: "lead" | "alert" | "muted" | "neutral" }> = {
  prix: { label: "Prix", tone: "lead" },
  commande: { label: "Commande", tone: "lead" },
  livraison: { label: "Livraison", tone: "lead" },
  disponibilite: { label: "Disponibilité", tone: "lead" },
  question: { label: "Question", tone: "neutral" },
  reclamation: { label: "Réclamation", tone: "alert" },
  compliment: { label: "Compliment", tone: "neutral" },
  spam: { label: "Spam", tone: "muted" },
  autre: { label: "Autre", tone: "muted" },
};
