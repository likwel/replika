import { z } from "zod";

// Corps JSON limité à 100 Ko par le serveur : un collage de CSV reste en dessous (≈ 200 lignes)
export const MAX_PASTED_CSV = 90_000;

export const sourceSchema = z
  .object({
    url: z.string().trim().max(1000).optional(), // lien Google Sheets ou CSV en ligne
    csv: z.string().max(MAX_PASTED_CSV, "Collage trop long : utilisez un lien Google Sheets ou importez moins de lignes").optional(), // contenu collé ou fichier lu par le navigateur
  })
  .refine((s) => Boolean(s.url?.length) !== Boolean(s.csv?.trim().length), "Indiquez le lien du tableur, ou collez son contenu");

const accountIds = z.array(z.string().min(1).max(50)).max(30).default([]);

export const previewSchema = z.object({ source: sourceSchema, accountIds, asDraft: z.boolean().default(false) });

export const commitSchema = previewSchema.extend({
  // Garder le tableur (lien uniquement) : relu périodiquement, les nouvelles lignes sont importées toutes seules
  save: z
    .object({
      name: z.string().trim().min(1, "Donnez un nom à cette source").max(80),
      autoSync: z.boolean().default(true),
      intervalMinutes: z.number().int().min(15).max(1440).default(60),
    })
    .optional(),
});

export const sourcePatchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  autoSync: z.boolean().optional(),
  intervalMinutes: z.number().int().min(15).max(1440).optional(),
  asDraft: z.boolean().optional(),
  accountIds: z.array(z.string().min(1).max(50)).max(30).optional(),
});

export type PreviewInput = z.infer<typeof previewSchema>;
export type CommitInput = z.infer<typeof commitSchema>;
