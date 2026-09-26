import { z } from "zod";

export const ruleSchema = z.object({
  name: z.string().trim().min(1, "Nom requis"),
  channel: z.enum(["ALL", "COMMENT", "DIRECT"]).optional(),
  matchType: z.enum(["CONTAINS", "EXACT", "ANY"]).optional(),
  trigger: z.string().trim().optional(),
  response: z.string().trim().min(1, "Réponse requise"),
  privateReply: z
    .string()
    .trim()
    .nullish()
    .transform((v) => v || null),
  autoSend: z.boolean().optional(),
  isActive: z.boolean().optional(),
  priority: z.number().int().min(-100).max(100).optional(),
  accountId: z.string().nullish(),
});

export const ruleUpdateSchema = ruleSchema.partial();

export const settingsSchema = z.object({
  autoReplyEnabled: z.boolean(),
});

export const testSchema = z.object({
  text: z.string().min(1, "Texte requis"),
  kind: z.enum(["COMMENT", "DIRECT"]).default("COMMENT"),
  accountId: z.string().optional(),
});

export type RuleInput = z.infer<typeof ruleSchema>;
export type RuleUpdateInput = z.infer<typeof ruleUpdateSchema>;
export type TestInput = z.infer<typeof testSchema>;
