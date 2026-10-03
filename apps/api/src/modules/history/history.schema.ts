import { z } from "zod";

// Les deux sous-catégories du menu Historique (« Actions » = tout, sans filtre)
export const HISTORY_CATEGORIES = ["message", "connexion"] as const;
export type HistoryCategory = (typeof HISTORY_CATEGORIES)[number];

export const listQuerySchema = z.object({
  category: z.enum(HISTORY_CATEGORIES).optional(),
  // curseur de pagination : entrées strictement plus anciennes que cette date
  before: z.string().datetime({ offset: true, message: "Date invalide" }).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export type ListQuery = z.infer<typeof listQuerySchema>;
