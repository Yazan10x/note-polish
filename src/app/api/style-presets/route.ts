// src/app/api/style-presets/route.ts
import { NextResponse } from "next/server";

import { UserAPI } from "@/server/api/UserAPI";
import { NoteGenerationAPI } from "@/server/api/NoteGenerationAPI";

const SESSION_COOKIE = "np_session";

function getSessionToken(req: Request): string | null {
    const cookieHeader = req.headers.get("cookie") ?? "";
    const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
    return match?.[1] ?? null;
}

export async function GET(req: Request) {
    const sessionToken = getSessionToken(req);
    if (!sessionToken) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const me = await UserAPI.getMe(sessionToken);
    if (!me) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const presets = await NoteGenerationAPI.listPublicStylePresets();
        return NextResponse.json({ presets });
    } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to load presets";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}