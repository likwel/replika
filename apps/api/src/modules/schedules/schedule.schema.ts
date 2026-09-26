import { z } from "zod";

// Étiquettes Messenger autorisées hors de la fenêtre de 24 h (contenu non promotionnel uniquement)
export const MESSAGE_TAGS = ["POST_PURCHASE_UPDATE", "CONFIRMED_EVENT_UPDATE", "ACCOUNT_UPDATE"] as const;

// Limites Meta : légende Instagram 2 200, commentaire 8 000, message Messenger 2 000
export const TEXT_LIMITS = { POST: 63_206, COMMENT: 8000, MESSAGE: 2000, INSTAGRAM_CAPTION: 2200 } as const;

const target = z.object({
  accountId: z.string().min(1).max(50),
  refId: z.string().trim().max(200).nullish(), // publication (commentaire) ou conversation (message)
  label: z.string().trim().max(300).nullish(),
});

const url = z
  .string()
  .trim()
  .max(1000)
  .refine((v) => /^https?:\/\/\S+$/i.test(v), "Adresse invalide (http:// ou https://)");

export const scheduleSchema = z
  .object({
    kind: z.enum(["POST", "COMMENT", "MESSAGE"]),
    text: z.string().trim().min(1, "Le texte est vide"),
    imageUrl: url.nullish(),
    link: url.nullish(),
    messageTag: z.enum(MESSAGE_TAGS).nullish(),
    scheduledAt: z.string().datetime({ offset: true, message: "Date invalide" }).nullish(),
    status: z.enum(["DRAFT", "SCHEDULED"]).default("SCHEDULED"),
    publishNow: z.boolean().optional(),
    targets: z.array(target).min(1, "Choisissez au moins une destination").max(30, "30 destinations maximum"),
  })
  .superRefine((v, ctx) => {
    const issue = (message: string, path: string[] = []) => ctx.addIssue({ code: z.ZodIssueCode.custom, message, path });
    if (v.text.length > TEXT_LIMITS[v.kind]) issue(`Texte trop long (${TEXT_LIMITS[v.kind]} caractères maximum)`, ["text"]);
    if (v.kind !== "POST" && (v.imageUrl || v.link)) issue("Image et lien sont réservés aux publications", ["imageUrl"]);
    if (v.kind !== "MESSAGE" && v.messageTag) issue("L'étiquette est réservée aux messages privés", ["messageTag"]);
    if (v.kind === "POST" && v.targets.some((t) => t.refId)) issue("Une publication vise une Page ou un compte", ["targets"]);
    if (v.kind !== "POST" && v.targets.some((t) => !t.refId)) {
      issue(v.kind === "COMMENT" ? "Choisissez la publication à commenter" : "Choisissez la conversation", ["targets"]);
    }
  });

export const listQuerySchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  status: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(",") : undefined))
    .pipe(z.array(z.enum(["DRAFT", "SCHEDULED", "PUBLISHING", "DONE", "PARTIAL", "FAILED"])).optional()),
  kind: z.enum(["POST", "COMMENT", "MESSAGE"]).optional(),
});

export type ScheduleInput = z.infer<typeof scheduleSchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
