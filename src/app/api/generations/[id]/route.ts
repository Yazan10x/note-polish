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

type Ctx =
    | { params: { id: string } }
    | { params: Promise<{ id: string }> };

async function getIdFromCtx(ctx: Ctx): Promise<string | null> {
    const paramsAny = (ctx as any)?.params;
    if (!paramsAny) return null;

    const params = typeof paramsAny?.then === "function" ? await paramsAny : paramsAny;
    const id = params?.id;

    return typeof id === "string" && id.trim().length ? id.trim() : null;
}

function iso(d: Date): string {
    return d.toISOString();
}

function extractHexId(v: unknown): string | null {
    if (!v) return null;

    if (v instanceof ObjectId) return v.toHexString();

    if (typeof v === "string") {
        const s = v.trim();
        const m = s.match(/[a-f0-9]{24}/i);
        return m ? m[0].toLowerCase() : null;
    }

    if (typeof v === "object") {
        const anyV = v as any;

        if (typeof anyV.$oid === "string") return extractHexId(anyV.$oid);
        if (anyV._id) return extractHexId(anyV._id);
        if (anyV.id) return extractHexId(anyV.id);
        if (anyV.user_id) return extractHexId(anyV.user_id);
        if (anyV.userId) return extractHexId(anyV.userId);

        try {
            const s = String(anyV);
            const m = s.match(/[a-f0-9]{24}/i);
            return m ? m[0].toLowerCase() : null;
        } catch {
            return null;
        }
    }

    return null;
}

function parseObjectIdFromParam(raw: string, label: string): ObjectId {
    const hex = extractHexId(raw);
    if (!hex) throw new Error(`Invalid ${label} id`);
    if (!ObjectId.isValid(hex)) throw new Error(`Invalid ${label} id`);
    return new ObjectId(hex);
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

        title: (doc as any).title,

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
    } as any;
}

async function requireUser() {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;
    if (!sessionToken) return null;

    const me = await UserAPI.getMe(sessionToken);
    if (!me) return null;

    const meId = extractHexId(
        (me as any).id ?? (me as any)._id ?? (me as any).user_id ?? (me as any).userId
    );
    if (!meId) return null;

    return { me, meId };
}

export async function GET(_req: Request, ctx: Ctx) {
    const auth = await requireUser();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rawId = await getIdFromCtx(ctx);
    if (!rawId) return NextResponse.json({ error: "Invalid generation id" }, { status: 400 });

    try {
        const genOid = parseObjectIdFromParam(rawId, "generation");

        const db = await ConnectionManager.getDb();
        const gens = db.collection<NoteGenerationDb>(COLLECTIONS.noteGenerations);

        const doc = await gens.findOne({ _id: genOid });
        if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const ownerId = extractHexId((doc as any).user_id);
        if (!ownerId || ownerId !== auth.meId) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        const generation = await toPublic(doc);
        return NextResponse.json(generation);
    } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to load generation";
        const status = msg.startsWith("Invalid ") ? 400 : 500;
        return NextResponse.json({ error: msg }, { status });
    }
}

const PatchSchema = z
    .object({
        title: z.string().optional(),
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
    .refine(
        (v) =>
            typeof v.title === "string" ||
            typeof v.input_text === "string" ||
            typeof v.style === "object",
        { message: "Nothing to update" }
    );

export async function PATCH(req: Request, ctx: Ctx) {
    const auth = await requireUser();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rawId = await getIdFromCtx(ctx);
    if (!rawId) return NextResponse.json({ error: "Invalid generation id" }, { status: 400 });

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
        const genOid = parseObjectIdFromParam(rawId, "generation");

        const db = await ConnectionManager.getDb();
        const gens = db.collection<NoteGenerationDb>(COLLECTIONS.noteGenerations);
        const styles = db.collection<StylePresetDb>(COLLECTIONS.stylePresets);

        const current = await gens.findOne({ _id: genOid });
        if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const ownerId = extractHexId((current as any).user_id);
        if (!ownerId || ownerId !== auth.meId) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        if (current.status !== "pending") {
            return NextResponse.json({ error: "Only pending generations can be edited" }, { status: 409 });
        }

        const patch = parsed.data;

        const $set: (Partial<NoteGenerationDb> & { updated_at: Date } & { title?: string }) = {
            updated_at: new Date(),
        };

        if (typeof patch.title === "string") {
            $set.title = patch.title.trim();
        }

        if (typeof patch.input_text === "string") {
            $set.input_text = patch.input_text;
        }

        if (patch.style?.mode === "preset") {
            const presetOid = parseObjectIdFromParam(patch.style.preset_id, "preset");
            const preset = await styles.findOne({ _id: presetOid, is_active: true });
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

        await gens.updateOne({ _id: genOid }, { $set });

        const updated = await gens.findOne({ _id: genOid });
        if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const generation = await toPublic(updated);
        return NextResponse.json(generation);
    } catch (e) {
        const msg = e instanceof Error ? e.message : "Update failed";
        const status = msg.startsWith("Invalid ") ? 400 : 500;
        return NextResponse.json({ error: msg }, { status });
    }
}

export async function DELETE(_req: Request, ctx: Ctx) {
    const auth = await requireUser();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rawId = await getIdFromCtx(ctx);
    if (!rawId) return NextResponse.json({ error: "Invalid generation id" }, { status: 400 });

    try {
        const genOid = parseObjectIdFromParam(rawId, "generation");

        const db = await ConnectionManager.getDb();
        const gens = db.collection<NoteGenerationDb>(COLLECTIONS.noteGenerations);

        const existing = await gens.findOne({ _id: genOid });
        if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const ownerId = extractHexId((existing as any).user_id);
        if (!ownerId || ownerId !== auth.meId) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        // 1) Delete child docs (adjust collection names if yours differ)
        const childCollections = [
            "note_generation_out_files",
            "note_generation_object_out_files",
        ];

        const childFilter = {
            $or: [
                { generation_id: genOid },
                { generation_id: genOid.toString() },
                { note_generation_id: genOid },
                { note_generation_id: genOid.toString() },
            ],
        };

        await Promise.allSettled(
            childCollections.map((name) => db.collection(name).deleteMany(childFilter))
        );

        // 2) Delete stored files referenced by the generation
        const keysToDelete = [
            ...(existing.input_files ?? []),
            ...(existing.output_files ?? []),
        ];

        await Promise.allSettled(keysToDelete.map((k) => FileManager.delete(k)));

        // 3) Delete the generation doc itself
        await gens.deleteOne({ _id: genOid });

        return NextResponse.json({ ok: true });
    } catch (e) {
        const msg = e instanceof Error ? e.message : "Delete failed";
        const status = msg.startsWith("Invalid ") ? 400 : 500;
        return NextResponse.json({ error: msg }, { status });
    }
}