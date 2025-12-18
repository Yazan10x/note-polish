// src/app/files/[id]/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ObjectId, GridFSBucket } from "mongodb";
import { Readable } from "node:stream";

import { ConnectionManager } from "@/lib/ConnectionManager";
import { UserAPI } from "@/server/api/UserAPI";

const SESSION_COOKIE = "np_session";

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

// Prefer exact 24-hex id; fallback to first 24-hex match (same pattern you use elsewhere).
function extractHexId(v: unknown): string | null {
    if (!v) return null;

    if (v instanceof ObjectId) return v.toHexString();

    if (typeof v === "string") {
        const s = v.trim();
        if (/^[a-f0-9]{24}$/i.test(s)) return s.toLowerCase();
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

async function requireUser() {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;
    if (!sessionToken) return null;

    const me = await UserAPI.getMe(sessionToken);
    if (!me) return null;

    const meId = extractHexId((me as any).id ?? (me as any)._id ?? (me as any).user_id ?? (me as any).userId);
    if (!meId) return null;

    return { me, meId };
}

type GridFsFileDoc = {
    _id: ObjectId;
    filename?: string;
    length?: number;
    contentType?: string;
    uploadDate?: Date;
    metadata?: any;
};

async function findFileInAnyBucket(db: any, fileId: ObjectId) {
    const bucketNames = ["fs", "files", "uploads"];

    for (const bucketName of bucketNames) {
        const filesCol = db.collection(`${bucketName}.files`) as import("mongodb").Collection<GridFsFileDoc>;
        const doc = await filesCol.findOne({ _id: fileId });
        if (doc) return { bucketName, doc };
    }

    return null;
}

export async function GET(_req: Request, ctx: Ctx) {
    const auth = await requireUser();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rawId = await getIdFromCtx(ctx);
    if (!rawId) return NextResponse.json({ error: "Invalid file id" }, { status: 400 });

    try {
        const fileOid = parseObjectIdFromParam(rawId, "file");

        const db = await ConnectionManager.getDb();

        const found = await findFileInAnyBucket(db, fileOid);
        if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const { bucketName, doc } = found;

        // NOTE: For now we only check authentication, as requested.
        // TODO later: enforce ownership/ACL based on doc.metadata (user_id, org_id, generation_id, etc).

        const bucket = new GridFSBucket(db, { bucketName });

        const filename =
            doc.filename ||
            doc?.metadata?.filename ||
            `${fileOid.toHexString()}`;

        const contentType =
            doc.contentType ||
            doc?.metadata?.contentType ||
            "application/octet-stream";

        const downloadStream = bucket.openDownloadStream(fileOid);

        // Convert Node stream to Web ReadableStream for Next.js Response
        const webStream = Readable.toWeb(downloadStream as any) as ReadableStream<Uint8Array>;

        return new Response(webStream, {
            status: 200,
            headers: {
                "Content-Type": contentType,
                // inline so PDFs/images open in browser
                "Content-Disposition": `inline; filename="${encodeURIComponent(filename)}"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to load file";
        const status = msg.startsWith("Invalid ") ? 400 : 500;
        return NextResponse.json({ error: msg }, { status });
    }
}