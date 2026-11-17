import { z } from "zod";

export const replySchema = z.object({
  reply: z.string().trim().min(1, "Réponse vide"),
});

export const seenSchema = z
  .object({ ids: z.array(z.string().min(1).max(50)).max(200).optional(), all: z.boolean().optional() })
  .refine((v) => v.all || (v.ids && v.ids.length > 0), "Indiquez les messages vus");

const statusEnum = z.enum(["PENDING", "REPLIED", "ESCALATED", "IGNORED"]);

export const listQuerySchema = z.object({
  // un ou plusieurs statuts séparés par des virgules : ?status=PENDING,ESCALATED
  status: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(",") : undefined))
    .pipe(z.array(statusEnum).optional()),
  kind: z.enum(["COMMENT", "DIRECT", "LIVE_COMMENT"]).optional(),
  // comptes affichés : ?accounts=id1,id2 (absent = tous)
  accounts: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 50) : undefined)),
});

export type ListQuery = z.infer<typeof listQuerySchema>;
