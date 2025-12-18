import { z } from "zod";

export const PublicUserSchema = z.object({
    id: z.string().min(1),
    full_name: z.string().min(1),
    email: z.email(),
    avatar_url: z.url().optional(),
    created_at: z.iso.datetime(),
    updated_at: z.iso.datetime(),
});

export type PublicUser = z.infer<typeof PublicUserSchema>;

export const SignupInputSchema = z.object({
    full_name: z.string().min(1),
    email: z.email(),
    password: z.string().min(8),
});

export type SignupInput = z.infer<typeof SignupInputSchema>;

export const LoginInputSchema = z.object({
    email: z.email(),
    password: z.string().min(1),
});

export type LoginInput = z.infer<typeof LoginInputSchema>;