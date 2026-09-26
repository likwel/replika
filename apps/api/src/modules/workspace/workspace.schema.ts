import { z } from "zod";

// Limites Meta : 8 000 caractères pour un commentaire, 2 000 pour un message Messenger
export const commentSchema = z.object({
  message: z.string().trim().min(1, "Message vide").max(8000, "Message trop long"),
});

export const directMessageSchema = z.object({
  message: z.string().trim().min(1, "Message vide").max(2000, "Message trop long (2 000 caractères maximum)"),
});

export const hideSchema = z.object({ hidden: z.boolean() });

export const suggestSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("COMMENT"),
    text: z.string().min(1, "Texte requis").max(8000),
    authorName: z.string().max(200).default("Client"),
    postId: z.string().max(200).optional(),
  }),
  z.object({ kind: z.literal("DIRECT"), conversationId: z.string().min(1).max(200) }),
]);

// ?accounts=id1,id2 (absent = tous les comptes)
export const parseAccountIds = (value: unknown): string[] | undefined =>
  typeof value === "string" && value.trim()
    ? value.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 50)
    : undefined;
