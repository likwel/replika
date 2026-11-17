import { z } from "zod";
import { sourceSchema } from "../schedules/import.schema.js";

const column = z.string().trim().max(200).nullable();

// Correspondance : pour chaque champ d'article, l'en-tête de la colonne du tableur (null : aucune)
export const mappingSchema = z.object({ code: column, name: column, price: column, stock: column });

export const readListSchema = z.object({ source: sourceSchema });
export const previewListSchema = z.object({ source: sourceSchema, mapping: mappingSchema });
export const createListSchema = z.object({ name: z.string().trim().min(1, "Donnez un nom à la liste").max(80), source: sourceSchema, mapping: mappingSchema });
export const updateListSchema = z.object({ name: z.string().trim().min(1).max(80).optional(), mapping: mappingSchema.optional() });
