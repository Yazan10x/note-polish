// src/app/api/generations/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ObjectId } from "mongodb";

import { ConnectionManager } from "@/lib/ConnectionManager";
import { UserAPI } from "@/server/api/UserAPI";

import type { PublicNoteGeneration } from "@/lib/models/noteGeneration";

const SESSION_COOKIE = "np_session";

function iso(d: Date): string {
    return d.toISOString();
}

function toPublic(doc: any): PublicNoteGeneration {
    const style =
        doc?.style ??
        (doc?.custom_prompt
            ? { mode: "custom", custom_prompt: String(doc.custom_prompt) }
            : { mode: "preset", preset_id: String(doc.preset_id ?? "") });

    return {
        id: String(doc._id),
        title: doc.title ?? "Untitled",
        input_text: doc.input_text ?? "",
        created_at: doc.created_at ? iso(new Date(doc.created_at)) : iso(new Date()),
        style,
        status: doc.status ?? "unknown",
        output_image_url: doc.output_image_url ?? null,
    } as any;
}

function asObjectId(v: unknown): ObjectId {
    if (v instanceof ObjectId) return v;
    const s = String(v ?? "");
    if (!ObjectId.isValid(s)) throw new Error("Invalid id");
    return new ObjectId(s);
}

export async function GET(req: Request) {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;

    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const me = await UserAPI.getMe(token);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userIdRaw = (me as any)._id ?? (me as any).id;
    const userId = asObjectId(userIdRaw);

    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const status = (url.searchParams.get("status") ?? "").trim();
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
    const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get("page_size") ?? "12") || 12));
    const skip = (page - 1) * pageSize;

    const db = await ConnectionManager.getDb();
    const col = db.collection("note_generations");

    const filter: any = { user_id: userId };

    if (q) {
        const or: any[] = [
            { title: { $regex: escapeRegex(q), $options: "i" } },
            { input_text: { $regex: escapeRegex(q), $options: "i" } },
        ];

        // allow searching by exact ObjectId string
        if (ObjectId.isValid(q)) {
            or.push({ _id: new ObjectId(q) });
        }

        filter.$or = or;
    }

    if (status) filter.status = status;

    const [docs, total] = await Promise.all([
        col.find(filter).sort({ created_at: -1 }).skip(skip).limit(pageSize).toArray(),
        col.countDocuments(filter),
    ]);

    return NextResponse.json({ items: docs.map(toPublic), total });
}

function escapeRegex(s: string) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}