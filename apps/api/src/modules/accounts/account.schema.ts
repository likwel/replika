import { z } from "zod";

export const createAccountSchema = z.object({
  platform: z.enum(["FACEBOOK", "INSTAGRAM", "TIKTOK"]),
  externalId: z.string().min(1),
  name: z.string().min(1),
  accessToken: z.string().min(1),
  expiresAt: z.string().datetime().optional(),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;