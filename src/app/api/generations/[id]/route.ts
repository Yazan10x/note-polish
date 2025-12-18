// src/app/api/generations/[id]/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ObjectId } from "mongodb";
import { z } from "zod";

import { ConnectionManager } from "@/lib/ConnectionManager";
import { FileManager } from "@/lib/FileManager";
import { UserAPI } from "@/server/api/UserAPI";

import type { NoteGenerationDb, StylePresetDb } from "@/server/models/noteGenerationDb";
import type { PublicNoteGeneration } from "@/lib/models/noteGeneration";

const SESSION_COOKIE = "np_session";

const COLLECTIONS = {
    stylePresets: "style_presets",
    noteGenerations: "note_generations",
} as const;

function oid(id: string): ObjectId {
    if (!ObjectId.isValid(id)) throw new Error("Invalid id");
    return new ObjectId(id);
}

function iso(d: Date): string {
    return d.toISOString();
}

async function toPublic(doc: NoteGenerationDb): Promise<PublicNoteGeneration> {
    const input_files = await Promise.all(
        (doc.input_files ?? []).map((k) => FileManager._get_presigned_url(k))
    );

    const output_files = doc.output_files?.length
        ? await Promise.all(doc.output_files.map((k) => FileManager._get_presigned_url(k)))
        : undefined;

    return {
        id: doc._id.toString(),

        status: doc.status,
        error: doc.error,

        input_text: doc.input_text,
        input_files,

        style: {
            mode: doc.style.mode,
            preset_id: doc.style.preset_id,
            custom_prompt: doc.style.custom_prompt,
            snapshot_title: doc.style.snapshot_title,
        },

        output_files,
        preview_images: doc.preview_images,

        is_favourite: doc.is_favourite,
        is_downloaded: doc.is_downloaded,

        created_at: iso(doc.created_at),
        updated_at: iso(doc.updated_at),
    };
}

const PatchSchema = z
    .object({
        input_text: z.string().optional(),
        style: z
            .union([
                z.object({
                    mode: z.literal("preset"),
                    preset_id: z.string().min(1),
                }),
                z.object({
                    mode: z.literal("custom"),
                    custom_prompt: z.string().min(1),
                }),
            ])
            .optional(),
    })
    .refine((v) => typeof v.input_text === "string" || typeof v.style === "object", {
        message: "Nothing to update",
    });

export async function PATCH(
    req: Request,
    ctx: { params: Promise<{ id: string }> } | { params: { id: string } }
) {
    const params = "then" in ctx.params ? await ctx.params : ctx.params;
    const generationId = params.id;

    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;
    if (!sessionToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const me = await UserAPI.getMe(sessionToken);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let json: unknown;
    try {
        json = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = PatchSchema.safeParse(json);
    if (!parsed.success) {
        return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    try {
        const db = await ConnectionManager.getDb();
        const gens = db.collection<NoteGenerationDb>(COLLECTIONS.noteGenerations);
        const styles = db.collection<StylePresetDb>(COLLECTIONS.stylePresets);

        const userId = oid(me.id);
        const genOid = oid(generationId);

        const current = await gens.findOne({ _id: genOid, user_id: userId });
        if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
        if (current.status !== "pending") {
            return NextResponse.json({ error: "Only pending generations can be edited" }, { status: 409 });
        }

        const patch = parsed.data;

        const $set: Partial<NoteGenerationDb> & { updated_at: Date } = {
            updated_at: new Date(),
        };

        if (typeof patch.input_text === "string") {
            $set.input_text = patch.input_text;
        }

        if (patch.style?.mode === "preset") {
            const preset = await styles.findOne({ _id: oid(patch.style.preset_id), is_active: true });
            if (!preset) return NextResponse.json({ error: "Invalid preset" }, { status: 400 });

            $set.style = {
                mode: "preset",
                preset_id: preset._id.toString(),
                snapshot_prompt: preset.prompt,
                snapshot_title: preset.title,
            };
        }

        if (patch.style?.mode === "custom") {
            const custom = patch.style.custom_prompt.trim();
            if (!custom) return NextResponse.json({ error: "Custom prompt required" }, { status: 400 });

            $set.style = {
                mode: "custom",
                custom_prompt: custom,
                snapshot_prompt: custom,
                snapshot_title: "Custom",
            };
        }

        await gens.updateOne({ _id: genOid, user_id: userId }, { $set });

        const updated = await gens.findOne({ _id: genOid, user_id: userId });
        if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const generation = await toPublic(updated);
        return NextResponse.json({ generation });
    } catch (e) {
        const msg = e instanceof Error ? e.message : "Update failed";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}