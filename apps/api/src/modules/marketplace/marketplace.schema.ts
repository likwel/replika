import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères maximum`)
    .nullish()
    .transform((v) => (v === undefined ? undefined : v || null));

export const listingSchema = z.object({
  accountId: z.string().min(1, "Compte requis"),
  title: z.string().trim().min(1, "Titre requis").max(120),
  description: optionalText(2000),
  price: z.number().int().min(0).max(1_000_000_000).nullish(),
  stock: z.number().int().min(0).max(100_000).nullish(),
  category: optionalText(60),
  images: z.array(z.string().trim().url()).max(10).optional(),
  status: z.enum(["ACTIVE", "SOLD_OUT", "ARCHIVED"]).optional(),
});

export const listingUpdateSchema = listingSchema.partial();

const orderFields = {
  customerName: z.string().trim().min(1, "Nom du client requis").max(120),
  quantity: z.number().int().min(1).max(999),
  unitPrice: z.number().int().min(0).max(1_000_000_000).nullish(),
  fullName: optionalText(120),
  phone: optionalText(40),
  address: optionalText(300),
  note: optionalText(500),
};

export const orderSchema = z.object({ ...orderFields, quantity: orderFields.quantity.default(1) });
export const orderUpdateSchema = z
  .object({ ...orderFields, status: z.enum(["NEW", "CONTACTED", "CONFIRMED", "DELIVERED", "CANCELED"]) })
  .partial();

// Connexion d'un catalogue Facebook à un compte (null = déconnecter)
export const connectCatalogSchema = z.object({
  catalogId: z.string().trim().min(1).max(100).nullable(),
  catalogName: z.string().trim().max(200).nullable(),
});

export type ConnectCatalogInput = z.infer<typeof connectCatalogSchema>;
export type ListingInput = z.infer<typeof listingSchema>;
export type ListingUpdateInput = z.infer<typeof listingUpdateSchema>;
export type OrderInput = z.infer<typeof orderSchema>;
export type OrderUpdateInput = z.infer<typeof orderUpdateSchema>;
