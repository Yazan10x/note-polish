import { z } from "zod";

/**
 * Public Style Preset (for UI)
 * prompt is intentionally NOT included here.
 */
export const PublicStylePresetSchema = z.object({
    id: z.string().min(1),
    key: z.string().min(1),
    title: z.string().min(1),
    sort_order: z.number().int(),
    image_url: z.string().min(1), // e.g. "/presets/readable_clean.png"

    created_at: z.iso.datetime(),
    updated_at: z.iso.datetime(),
});

export type PublicStylePreset = z.infer<typeof PublicStylePresetSchema>;

/**
 * Public Note Generation
 * snapshot_prompt is intentionally NOT included here.
 */
export const PublicNoteGenerationSchema = z.object({
    id: z.string().min(1),

    title: z.string().optional(),

    status: z.enum(["pending", "queued", "processing", "processed", "failed"]),
    error: z.string().optional(),

    input_text: z.string().optional(),
    input_files: z.array(z.string().min(1)), // URLs

    style: z.object({
        mode: z.enum(["preset", "custom"]),
        preset_id: z.string().optional(),
        custom_prompt: z.string().optional(),
        snapshot_title: z.string().optional(),
    }),

    output_files: z.array(z.string().min(1)).optional(), // URLs
    preview_images: z.array(z.string().min(1)).optional(), // base64 or data URLs

    is_favourite: z.boolean(),
    is_downloaded: z.boolean(),

    created_at: z.iso.datetime(),
    updated_at: z.iso.datetime(),
});

export type PublicNoteGeneration = z.infer<typeof PublicNoteGenerationSchema>;