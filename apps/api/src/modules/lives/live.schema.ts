import { z } from "zod";
import { FIELDS } from "./live.matcher.js";

const template = (max = 1000) => z.string().trim().min(1, "Message vide").max(max, `${max} caractères maximum`);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères maximum`)
    .nullish()
    .transform((v) => (v === undefined ? undefined : v || null));

export const productSchema = z.object({
  code: z.string().trim().min(1, "Code requis").max(20, "Code trop long (20 caractères)"),
  name: z.string().trim().min(1, "Nom de l'article requis").max(120),
  price: z.number().int().min(0).max(1_000_000_000).nullish(),
  stock: z.number().int().min(0).max(100_000).nullish(),
});

export const productsSchema = z.object({
  products: z
    .array(productSchema)
    .max(500)
    .refine((list) => new Set(list.map((p) => p.code.toLowerCase())).size === list.length, "Deux articles ont le même code"),
});

const settings = {
  title: z.string().trim().min(1, "Titre requis").max(120),
  keywords: z.string().trim().min(1, "Au moins un mot-clé").max(300),
  requiredFields: z.array(z.enum(FIELDS)).max(3),
  autoMessage: z.boolean(),
  replyPublic: optionalText(500),
  firstMessage: template(),
  missingMessage: template(),
  confirmMessage: template(),
  soldOutMessage: template(),
  recapMessage: template(1500),
  recapUpdateMessage: template(1500),
  deliveryFee: z.number().int().min(0).max(1_000_000_000),
};

export const createSessionSchema = z
  .object({
    accountId: z.string().min(1).max(50),
    source: z.object({
      type: z.enum(["live", "post"]),
      objectId: z.string().trim().min(1).max(200), // vidéo, publication ou média Instagram
      liveVideoId: z.string().trim().max(200).nullish(),
      permalink: z.string().trim().max(1000).nullish(),
      thumbnail: z.string().trim().max(2000).nullish(),
    }),
    includeExisting: z.boolean().default(true), // traiter aussi les commentaires déjà publiés
    products: productsSchema.shape.products.default([]),
  })
  .merge(z.object(settings).partial());

export const updateSessionSchema = z
  .object({ ...settings, status: z.enum(["ACTIVE", "PAUSED", "ENDED"]) })
  .partial();

const orderFields = {
  customerName: z.string().trim().min(1, "Nom du client requis").max(120),
  code: optionalText(20),
  productName: optionalText(120),
  quantity: z.number().int().min(1).max(999),
  unitPrice: z.number().int().min(0).max(1_000_000_000).nullish(),
  fullName: optionalText(120),
  phone: optionalText(40),
  address: optionalText(300),
  note: optionalText(500),
};

export const createOrderSchema = z.object({ ...orderFields, quantity: orderFields.quantity.default(1) });
export const updateOrderSchema = z
  .object({ ...orderFields, status: z.enum(["NEW", "MESSAGED", "PARTIAL", "CONFIRMED", "WAITLIST", "DELIVERED", "CANCELED"]) })
  .partial();

export const messageSchema = z.object({ text: optionalText(2000) });

export const updateInvoiceSchema = z.object({
  deliveryFee: z.number().int().min(0).max(1_000_000_000),
});

export const markJpSchema = z.object({
  code: optionalText(20),
  quantity: z.number().int().min(1).max(99).default(1),
});

export const detectSchema = z.object({
  text: z.string().max(2000),
  keywords: z.string().max(300).optional(),
  products: z.array(productSchema).max(500).optional(),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
