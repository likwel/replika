import { z } from "zod";

// Étapes d'un pipeline. « Condition » : si elle n'est pas remplie, l'exécution s'arrête là (sans erreur).
// « Action » : fait quelque chose. Chaque étape a un identifiant stable (suivi dans la trace d'exécution).
const id = z.string().trim().min(1).max(40);

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure au format HH:MM");
export const LEAD_INTENTS = ["prix", "commande", "livraison", "disponibilite", "question", "reclamation", "compliment", "autre"] as const;

export const stepSchema = z.discriminatedUnion("type", [
  // Condition : le message correspond à une règle de réponse (ses mots-clés et son canal)
  z.object({ id, type: z.literal("MATCH_RULE"), config: z.object({ ruleId: z.string().min(1, "Choisissez une règle") }) }),
  // Condition : le lead a une note d'au moins N
  z.object({ id, type: z.literal("MIN_SCORE"), config: z.object({ min: z.number().int().min(1).max(100) }) }),
  // Condition : le message contient un de ces mots (séparés par des virgules), sans passer par une règle
  z.object({
    id,
    type: z.literal("KEYWORD"),
    config: z.object({ keywords: z.string().trim().min(1, "Indiquez au moins un mot").max(300), mode: z.enum(["CONTAINS", "EXACT"]).default("CONTAINS") }),
  }),
  // Condition : commentaire public ou message privé
  z.object({ id, type: z.literal("CHANNEL"), config: z.object({ kind: z.enum(["COMMENT", "DIRECT"]) }) }),
  // Condition : réseau du compte
  z.object({ id, type: z.literal("PLATFORM"), config: z.object({ platform: z.enum(["FACEBOOK", "INSTAGRAM"]) }) }),
  // Condition : le lead est dans l'un de ces statuts
  z.object({ id, type: z.literal("LEAD_STATUS"), config: z.object({ statuses: z.array(z.enum(["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST"])).min(1, "Choisissez au moins un statut") }) }),
  // Condition : l'intention du lead (prix, commande, réclamation…)
  z.object({ id, type: z.literal("LEAD_INTENT"), config: z.object({ intents: z.array(z.enum(LEAD_INTENTS)).min(1, "Choisissez au moins une intention") }) }),
  // Condition : le lead a laissé un téléphone ou un e-mail
  z.object({ id, type: z.literal("LEAD_CONTACT"), config: z.object({}).default({}) }),
  // Condition : pendant ou en dehors des horaires d'ouverture (heure de Madagascar)
  z.object({ id, type: z.literal("BUSINESS_HOURS"), config: z.object({ mode: z.enum(["INSIDE", "OUTSIDE"]), from: hhmm, to: hhmm }) }),
  // Action : message privé à l'auteur ({nom} et {page} sont remplacés)
  z.object({ id, type: z.literal("SEND_DM"), config: z.object({ text: z.string().trim().min(1, "Écrivez le message à envoyer").max(1000) }) }),
  // Action : change le statut du lead
  z.object({ id, type: z.literal("SET_LEAD_STATUS"), config: z.object({ status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST"]) }) }),
  // Action : place le message dans « À traiter » comme escaladé
  z.object({ id, type: z.literal("ESCALATE"), config: z.object({}).default({}) }),
  // Action : réponse publique sous le commentaire (sans effet sur un message privé)
  z.object({ id, type: z.literal("SEND_PUBLIC_REPLY"), config: z.object({ text: z.string().trim().min(1, "Écrivez la réponse").max(500) }) }),
  // Action : ajoute une note à la fiche du lead
  z.object({ id, type: z.literal("SET_LEAD_NOTE"), config: z.object({ text: z.string().trim().min(1, "Écrivez la note").max(300) }) }),
  // Action : estime la valeur du lead (Ar)
  z.object({ id, type: z.literal("SET_LEAD_VALUE"), config: z.object({ value: z.number().int().min(0).max(1_000_000_000) }) }),
  // Action : marque le message comme ignoré (il quitte « À traiter »)
  z.object({ id, type: z.literal("IGNORE_MESSAGE"), config: z.object({}).default({}) }),
  // Action : e-mail au propriétaire de l'espace
  z.object({ id, type: z.literal("EMAIL_OWNER"), config: z.object({ text: z.string().trim().min(1, "Écrivez le message de l'e-mail").max(300) }) }),
  // Action : envoie l'événement à une adresse web (https) : Zapier, Make, votre propre outil…
  z.object({ id, type: z.literal("WEBHOOK"), config: z.object({ url: z.string().trim().url("Adresse invalide").max(2000).refine((u) => /^https:\/\//i.test(u), "L'adresse doit commencer par https://") }) }),
  // Action : note dans l'historique (visible de l'équipe)
  z.object({ id, type: z.literal("NOTIFY"), config: z.object({ text: z.string().trim().min(1, "Écrivez la note").max(300) }) }),
]);

export type PipelineStep = z.infer<typeof stepSchema>;

const base = z.object({
  name: z.string().trim().min(1, "Nom requis").max(80),
  description: z
    .string()
    .trim()
    .max(300)
    .nullish()
    .transform((v) => v || null),
  trigger: z.enum(["NEW_COMMENT", "NEW_MESSAGE", "NEW_LEAD", "HOT_LEAD"]),
  accountIds: z.array(z.string().min(1)).max(100).default([]), // vide = tous les comptes
  steps: z.array(stepSchema).min(1, "Ajoutez au moins une étape").max(12, "12 étapes au maximum"),
  isActive: z.boolean().optional(),
});

export const pipelineSchema = base;
export const pipelineUpdateSchema = base.partial();

export type PipelineInput = z.infer<typeof pipelineSchema>;
export type PipelineUpdateInput = z.infer<typeof pipelineUpdateSchema>;
