// src/app/api/generations/[id]/submit/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ObjectId } from "mongodb";

import { ConnectionManager } from "@/lib/ConnectionManager";
import { FileManager } from "@/lib/FileManager";
import { UserAPI } from "@/server/api/UserAPI";

import type { NoteGenerationDb } from "@/server/models/noteGenerationDb";
import type { PublicNoteGeneration } from "@/lib/models/noteGeneration";

const SESSION_COOKIE = "np_session";

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

export async function POST(_req: Request, ctx: Ctx) {
    const auth = await requireUser();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rawId = await getIdFromCtx(ctx);
    if (!rawId) return NextResponse.json({ error: "Invalid generation id" }, { status: 400 });

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
            return NextResponse.json({ error: "Only pending generations can be submitted" }, { status: 409 });
        }

        const hasText = Boolean(existing.input_text?.trim());
        const hasFiles = (existing.input_files?.length ?? 0) > 0;
        if (!hasText && !hasFiles) {
            return NextResponse.json({ error: "Add text or upload at least one file before submitting" }, { status: 400 });
        }

        const res = await gens.updateOne(
            { _id: genOid, user_id: userOid, status: "pending" },
            {
                $set: {
                    status: "queued" as any,
                    error: undefined,
                    updated_at: new Date(),
                },
                $unset: {
                    preview_images: "",
                },
            }
        );

        if (res.matchedCount !== 1) {
            return NextResponse.json({ error: "Only pending generations can be submitted" }, { status: 409 });
        }

        const updated = await gens.findOne({ _id: genOid });
        if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

        return NextResponse.json({ ok: true, generation: await toPublic(updated) }, { status: 202 });
    } catch (e) {
        const msg = e instanceof Error ? e.message : "Submit failed";
        const status = msg.startsWith("Invalid ") ? 400 : 500;
        return NextResponse.json({ error: msg }, { status });
    }
}