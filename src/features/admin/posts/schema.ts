import { z } from "zod";

export const postSchema = z.object({
  title: z
    .string()
    .min(1, "タイトルは必須です")
    .max(120, "タイトルは120文字以内です"),
  body: z.string().min(1, "本文は必須です"),
});

export type PostInput = z.infer<typeof postSchema>;

// ZodError → Inertia の errors prop ( { field: message } )
export const toErrors = (err: z.ZodError) => {
  const errors: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }
  return errors;
};
