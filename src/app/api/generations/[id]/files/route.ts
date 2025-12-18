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
    const incoming = [...form.getAll("file"), ...form.getAll("files"), ...form.getAll("files[]")];

    const files: File[] = [];
    for (const v of incoming) {
        if (v instanceof File) files.push(v);
    }
    return files;
}

export async function POST(req: Request, ctx: Ctx) {
    const auth = await requireUser();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rawId = await getIdFromCtx(ctx);
    if (!rawId) return NextResponse.json({ error: "Invalid generation id" }, { status: 400 });

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
    if (files.length === 0) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (files.length > 1) return NextResponse.json({ error: "Only 1 file is allowed for now" }, { status: 400 });

    const f = files[0]!;
    if (!isAllowedMime(f.type)) {
        return NextResponse.json(
            { error: `Unsupported file type: ${f.type || "unknown"}` },
            { status: 400 }
        );
    }
    if (f.size <= 0) return NextResponse.json({ error: "Empty file" }, { status: 400 });
    if (f.size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: "File too large. Max is 5MB." }, { status: 413 });
    }

    const uploadedKeys: string[] = [];

    try {
        const genOid = parseObjectIdFromParam(rawId, "generation");
        const userOid = parseObjectIdFromParam(auth.meId, "user");

        const db = await ConnectionManager.getDb();
        const gens = db.collection<NoteGenerationDb>(COLLECTIONS.noteGenerations);

        const existing = await gens.findOne({ _id: genOid });
        if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const ownerId = extractHexId((existing as any).user_id);
        if (!ownerId || ownerId !== auth.meId) return NextResponse.json({ error: "Not found" }, { status: 404 });

        if (existing.status !== "pending") {
            return NextResponse.json({ error: "Only pending generations can be edited" }, { status: 409 });
        }

        const key = await FileManager.upload(f);
        uploadedKeys.push(key);

        const res = await gens.updateOne(
            { _id: genOid, user_id: userOid },
            {
                $addToSet: { input_files: { $each: uploadedKeys } },
                $set: { updated_at: new Date() },
            }
        );

        if (res.matchedCount !== 1) throw new Error("Not found");

        const updated = await gens.findOne({ _id: genOid });
        if (!updated) throw new Error("Not found");

        return NextResponse.json({
            ok: true,
            added_keys: uploadedKeys,
            generation: await toPublic(updated),
        });
    } catch (e) {
        await Promise.allSettled(uploadedKeys.map((k) => FileManager.delete(k)));

        const msg = e instanceof Error ? e.message : "Upload failed";
        const status = msg.startsWith("Invalid ") ? 400 : msg === "Not found" ? 404 : 500;
        return NextResponse.json({ error: msg }, { status });
    }
}

export async function DELETE(req: Request, ctx: Ctx) {
    const auth = await requireUser();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rawId = await getIdFromCtx(ctx);
    if (!rawId) return NextResponse.json({ error: "Invalid generation id" }, { status: 400 });

    const url = new URL(req.url);
    const fileKeyRaw = url.searchParams.get("fileKey")?.trim();
    if (!fileKeyRaw) return NextResponse.json({ error: "Missing fileKey" }, { status: 400 });

    // Convert "/files/<hex>" or "http://.../files/<hex>" into "<hex>"
    function normalizeToComparable(v: string): string {
        const hex = extractHexId(v);
        if (hex) return hex; // best match for mongo/gridfs ids
        return v.trim();
    }

    try {
        const genOid = parseObjectIdFromParam(rawId, "generation");
        const userOid = parseObjectIdFromParam(auth.meId, "user");

        const db = await ConnectionManager.getDb();
        const gens = db.collection<NoteGenerationDb>(COLLECTIONS.noteGenerations);

        const existing = await gens.findOne({ _id: genOid });
        if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const ownerId = extractHexId((existing as any).user_id);
        if (!ownerId || ownerId !== auth.meId) return NextResponse.json({ error: "Not found" }, { status: 404 });

        if (existing.status !== "pending") {
            return NextResponse.json({ error: "Only pending generations can be edited" }, { status: 409 });
        }

        const wanted = normalizeToComparable(fileKeyRaw);

        // Find the exact stored entry to remove (important: remove the stored key, not the URL)
        const storedKey =
            (existing.input_files ?? []).find((k) => k === fileKeyRaw) ??
            (existing.input_files ?? []).find((k) => normalizeToComparable(k) === wanted);

        if (!storedKey) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        await gens.updateOne(
            { _id: genOid, user_id: userOid },
            { $pull: { input_files: storedKey }, $set: { updated_at: new Date() } }
        );

        // Delete using the stored key (mongo case expects the id, not "/files/<id>")
        await FileManager.delete(storedKey).catch(() => {});

        const updated = await gens.findOne({ _id: genOid });
        if (!updated) throw new Error("Not found");

        return NextResponse.json({
            ok: true,
            removed_key: storedKey,
            generation: await toPublic(updated),
        });
    } catch (e) {
        const msg = e instanceof Error ? e.message : "Delete failed";
        const status = msg.startsWith("Invalid ") ? 400 : msg === "Not found" ? 404 : 500;
        return NextResponse.json({ error: msg }, { status });
    }
}