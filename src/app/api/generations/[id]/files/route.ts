// src/app/api/generations/[id]/files/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ObjectId } from "mongodb";

import { UserAPI } from "@/server/api/UserAPI";
import { NoteGenerationAPI } from "@/server/api/NoteGenerationAPI";

const SESSION_COOKIE = "np_session";
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 2 MB

function isAllowedMime(type: string): boolean {
    if (!type) return false;
    if (type === "application/pdf") return true;
    if (type.startsWith("image/")) return true;
    return false;
}

export async function POST(
    req: Request,
    ctx: { params: { id: string } }
) {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;

    if (!sessionToken) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const me = await UserAPI.getMe(sessionToken);
    if (!me) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    // support both keys: files[] and file
    const incoming = [
        ...form.getAll("files"),
        ...form.getAll("files[]"),
        ...form.getAll("file"),
    ];

    const files: File[] = [];
    for (const v of incoming) {
        if (v instanceof File) files.push(v);
    }

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
        if (f.size > MAX_FILE_BYTES) {
            return NextResponse.json(
                { error: `File too large. Max is 5 MB per file.` },
                { status: 413 }
            );
        }
    }

    try {
        await NoteGenerationAPI.addInputFiles(
            new ObjectId(me.id),
            ctx.params.id,
            files
        );

        const updated = await NoteGenerationAPI.getById(new ObjectId(me.id), ctx.params.id);
        return NextResponse.json({ generation: updated });
    } catch (e) {
        const msg = e instanceof Error ? e.message : "Upload failed";

        const status =
            msg === "Invalid id" ? 400 :
                msg === "Not found" ? 404 :
                    msg === "Only pending generations can be edited" ? 409 :
                        500;

        return NextResponse.json({ error: msg }, { status });
    }
}