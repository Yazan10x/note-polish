// src/app/api/generations/[id]/files/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ObjectId } from "mongodb";

import { ConnectionManager } from "@/lib/ConnectionManager";
import { FileManager } from "@/lib/FileManager";
import { UserAPI } from "@/server/api/UserAPI";

import type { NoteGenerationDb } from "@/server/models/noteGenerationDb";
import type { PublicNoteGeneration } from "@/lib/models/noteGeneration";

const SESSION_COOKIE = "np_session";
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

const COLLECTIONS = {
    noteGenerations: "note_generations",
} as const;

function isAllowedMime(type: string): boolean {
    if (!type) return false;
    if (type === "application/pdf") return true;
    if (type.startsWith("image/")) return true;
    return false;
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
        return extractHexId(anyV.id ?? anyV._id ?? anyV.user_id ?? anyV.userId);
    }

    return null;
}

function parseObjectIdFromParam(raw: string, label: string): ObjectId {
    const hex = extractHexId(raw);
    if (!hex) throw new Error(`Invalid ${label} id`);
    if (!ObjectId.isValid(hex)) throw new Error(`Invalid ${label} id`);
    return new ObjectId(hex);
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
        title: doc.title,

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

function collectFiles(form: FormData): File[] {
    const incoming = [
        ...form.getAll("files"),
        ...form.getAll("files[]"),
        ...form.getAll("file"),
    ];

    const files: File[] = [];
    for (const v of incoming) {
        if (v instanceof File) files.push(v);
    }
    return files;
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
    const auth = await requireUser();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
        return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 415 });
    }

    let form: FormData;
    try {
        form = await req.formData();
    } catch {
        return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    }

    const files = collectFiles(form);
    if (files.length === 0) {
        return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    for (const f of files) {
        if (!isAllowedMime(f.type)) {
            return NextResponse.json(
                { error: `Unsupported file type: ${f.type || "unknown"}` },
                { status: 400 }
            );
        }
        if (f.size <= 0) {
            return NextResponse.json({ error: "Empty file" }, { status: 400 });
        }
        if (f.size > MAX_FILE_BYTES) {
            return NextResponse.json(
                { error: `File too large. Max is ${MAX_FILE_BYTES} bytes per file.` },
                { status: 413 }
            );
        }
    }

    const rawId = ctx.params.id?.trim();
    if (!rawId) return NextResponse.json({ error: "Invalid generation id" }, { status: 400 });

    const uploadedKeys: string[] = [];

    try {
        const genOid = parseObjectIdFromParam(rawId, "generation");
        const userOid = parseObjectIdFromParam(auth.meId, "user");

        const db = await ConnectionManager.getDb();
        const gens = db.collection<NoteGenerationDb>(COLLECTIONS.noteGenerations);

        const existing = await gens.findOne({ _id: genOid });
        if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const ownerId = extractHexId((existing as any).user_id);
        if (!ownerId || ownerId !== auth.meId) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        if (existing.status !== "pending") {
            return NextResponse.json({ error: "Only pending generations can be edited" }, { status: 409 });
        }

        for (const f of files) {
            const key = await FileManager.upload(f);
            uploadedKeys.push(key);
        }

        const res = await gens.updateOne(
            { _id: genOid, user_id: userOid },
            {
                $addToSet: { input_files: { $each: uploadedKeys } },
                $set: { updated_at: new Date() },
            }
        );

        if (res.matchedCount !== 1) {
            throw new Error("Not found");
        }

        const updated = await gens.findOne({ _id: genOid });
        if (!updated) throw new Error("Not found");

        return NextResponse.json({
            ok: true,
            added_keys: uploadedKeys,
            generation: await toPublic(updated),
        });
    } catch (e) {
        for (const k of uploadedKeys) {
            await FileManager.delete(k).catch(() => {});
        }

        const msg = e instanceof Error ? e.message : "Upload failed";
        const status = msg.startsWith("Invalid ") ? 400 : msg === "Not found" ? 404 : 500;
        return NextResponse.json({ error: msg }, { status });
    }
}

export async function DELETE(req: Request, ctx: { params: { id: string } }) {
    const auth = await requireUser();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rawId = ctx.params.id?.trim();
    if (!rawId) return NextResponse.json({ error: "Invalid generation id" }, { status: 400 });

    const url = new URL(req.url);
    const fileKey = url.searchParams.get("fileKey")?.trim();
    if (!fileKey) return NextResponse.json({ error: "Missing fileKey" }, { status: 400 });

    try {
        const genOid = parseObjectIdFromParam(rawId, "generation");
        const userOid = parseObjectIdFromParam(auth.meId, "user");

        const db = await ConnectionManager.getDb();
        const gens = db.collection<NoteGenerationDb>(COLLECTIONS.noteGenerations);

        const existing = await gens.findOne({ _id: genOid });
        if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const ownerId = extractHexId((existing as any).user_id);
        if (!ownerId || ownerId !== auth.meId) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        if (existing.status !== "pending") {
            return NextResponse.json({ error: "Only pending generations can be edited" }, { status: 409 });
        }

        if (!(existing.input_files ?? []).includes(fileKey)) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        // Detach first, then delete bytes. If delete bytes fails, you at least removed it from the note.
        await gens.updateOne(
            { _id: genOid, user_id: userOid },
            { $pull: { input_files: fileKey }, $set: { updated_at: new Date() } }
        );

        await FileManager.delete(fileKey).catch(() => {});

        const updated = await gens.findOne({ _id: genOid });
        if (!updated) throw new Error("Not found");

        return NextResponse.json({
            ok: true,
            removed_key: fileKey,
            generation: await toPublic(updated),
        });
    } catch (e) {
        const msg = e instanceof Error ? e.message : "Delete failed";
        const status = msg.startsWith("Invalid ") ? 400 : msg === "Not found" ? 404 : 500;
        return NextResponse.json({ error: msg }, { status });
    }
}