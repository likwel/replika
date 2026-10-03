import { z } from "zod";

export const DAY_RANGES = [7, 14, 30] as const;

export const daysQuerySchema = z.object({
  days: z.coerce
    .number()
    .int()
    .refine((v): v is (typeof DAY_RANGES)[number] => (DAY_RANGES as readonly number[]).includes(v), "7, 14 ou 30 jours")
    .default(7),
});

export type DaysQuery = z.infer<typeof daysQuerySchema>;
