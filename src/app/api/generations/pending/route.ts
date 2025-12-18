// src/app/api/generations/pending/route.ts
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { UserAPI } from "@/server/api/UserAPI";
import { NoteGenerationAPI } from "@/server/api/NoteGenerationAPI";

const SESSION_COOKIE = "np_session";

function getSessionToken(req: Request): string | null {
    const cookieHeader = req.headers.get("cookie") ?? "";
    const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
    return match?.[1] ?? null;
}

export async function POST(req: Request) {
    const sessionToken = getSessionToken(req);
    if (!sessionToken) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const me = await UserAPI.getMe(sessionToken);
    if (!me) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const doc = await NoteGenerationAPI.getOrCreatePending(new ObjectId(me.id));
        const publicGen = await NoteGenerationAPI.toPublic(doc);
        return NextResponse.json({ generation: publicGen });
    } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to load pending generation";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}