import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2, "Le nom est trop court"),
  email: z.string().email("E-mail invalide"),
  password: z.string().min(8, "Le mot de passe doit faire au moins 8 caractères"),
});

export const loginSchema = z.object({
  email: z.string().email("E-mail invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

export const forgotSchema = z.object({
  email: z.string().email("E-mail invalide"),
});

export const resetSchema = z.object({
  token: z.string().min(1, "Token requis"),
  password: z.string().min(8, "Le mot de passe doit faire au moins 8 caractères"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotInput = z.infer<typeof forgotSchema>;
export type ResetInput = z.infer<typeof resetSchema>;