import { z } from "zod";

// Absent → undefined (inchangé) ; vide → null (effacé)
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères maximum`)
    .nullish()
    .transform((v) => (v === undefined ? undefined : v || null));

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Le nom est trop court").max(80, "Nom trop long").optional(),
  phone: optionalText(30).refine((v) => !v || /^\+?[\d\s().-]{6,}$/.test(v), "Numéro de téléphone invalide"),
  companyName: optionalText(100),
  address: optionalText(200),
  // Photo recadrée et compressée par le navigateur (~30 Ko)
  avatarUrl: z
    .string()
    .max(250_000, "Image trop lourde")
    .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, "Format d'image non pris en charge")
    .nullable()
    .optional(),
});

export const emailSchema = z.object({
  email: z.string().trim().email("E-mail invalide"),
  currentPassword: z.string().min(1, "Mot de passe actuel requis"),
});

export const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Mot de passe actuel requis"),
  newPassword: z
    .string()
    .min(8, "Le nouveau mot de passe doit faire au moins 8 caractères")
    .max(128, "Mot de passe trop long"),
});

export const DEFAULT_PAGES = ["gestion", "automatisation", "statistiques"] as const;

export const preferencesSchema = z.object({
  autoReplyEnabled: z.boolean().optional(),
  defaultPage: z.enum(DEFAULT_PAGES).optional(),
  desktopNotifications: z.boolean().optional(),
});

export const deleteSchema = z.object({
  password: z.string().min(1, "Mot de passe requis"),
  confirm: z.literal("SUPPRIMER", { errorMap: () => ({ message: "Tapez « SUPPRIMER » pour confirmer" }) }),
});

export type ProfileInput = z.infer<typeof profileSchema>;
export type EmailInput = z.infer<typeof emailSchema>;
export type PasswordInput = z.infer<typeof passwordSchema>;
export type PreferencesInput = z.infer<typeof preferencesSchema>;
