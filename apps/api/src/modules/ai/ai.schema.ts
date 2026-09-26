import { z } from "zod";

// Absent → undefined (champ inchangé) ; vide → null (champ effacé)
const optionalText = (max: number) =>
  z
    .string()
    .max(max, `Texte trop long (${max} caractères maximum)`)
    .nullish()
    .transform((v) => (v === undefined ? undefined : v?.trim() || null));

export const aiAccountSchema = z.object({
  aiEnabled: z.boolean().optional(),
  aiAutoSend: z.boolean().optional(),
  aiChannel: z.enum(["ALL", "COMMENT", "DIRECT"]).optional(),
  aiContext: optionalText(8000),
  aiInstructions: optionalText(2000),
});

export const aiTestSchema = z.object({
  accountId: z.string().min(1, "Compte requis"),
  text: z.string().trim().min(1, "Texte requis"),
  kind: z.enum(["COMMENT", "DIRECT"]).default("COMMENT"),
  // Brouillon non enregistré : permet de tester avant de sauvegarder
  aiContext: optionalText(8000),
  aiInstructions: optionalText(2000),
});

export type AiAccountInput = z.infer<typeof aiAccountSchema>;
export type AiTestInput = z.infer<typeof aiTestSchema>;
