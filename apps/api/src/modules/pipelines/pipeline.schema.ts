import { z } from "zod";

// Étapes d'un pipeline. « Condition » : si elle n'est pas remplie, l'exécution s'arrête là (sans erreur).
// « Action » : fait quelque chose. Chaque étape a un identifiant stable (suivi dans la trace d'exécution).
const id = z.string().trim().min(1).max(40);

export const stepSchema = z.discriminatedUnion("type", [
  // Condition : le message correspond à une règle de réponse (ses mots-clés et son canal)
  z.object({ id, type: z.literal("MATCH_RULE"), config: z.object({ ruleId: z.string().min(1, "Choisissez une règle") }) }),
  // Condition : le lead a une note d'au moins N
  z.object({ id, type: z.literal("MIN_SCORE"), config: z.object({ min: z.number().int().min(1).max(100) }) }),
  // Action : message privé à l'auteur ({nom} et {page} sont remplacés)
  z.object({ id, type: z.literal("SEND_DM"), config: z.object({ text: z.string().trim().min(1, "Écrivez le message à envoyer").max(1000) }) }),
  // Action : change le statut du lead
  z.object({ id, type: z.literal("SET_LEAD_STATUS"), config: z.object({ status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST"]) }) }),
  // Action : place le message dans « À traiter » comme escaladé
  z.object({ id, type: z.literal("ESCALATE"), config: z.object({}).default({}) }),
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
  accountId: z.string().nullish(),
  steps: z.array(stepSchema).min(1, "Ajoutez au moins une étape").max(12, "12 étapes au maximum"),
  isActive: z.boolean().optional(),
});

export const pipelineSchema = base;
export const pipelineUpdateSchema = base.partial();

export type PipelineInput = z.infer<typeof pipelineSchema>;
export type PipelineUpdateInput = z.infer<typeof pipelineUpdateSchema>;
