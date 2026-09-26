import { z } from "zod";

export const replySchema = z.object({
  reply: z.string().trim().min(1, "Réponse vide"),
});

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
