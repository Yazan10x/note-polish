// src/app/api/dashboard/route.ts
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { UserAPI } from "@/server/api/UserAPI";
import { NoteGenerationAPI } from "@/server/api/NoteGenerationAPI";

const SESSION_COOKIE = "np_session";

export async function GET(req: Request) {
    const cookieHeader = req.headers.get("cookie") ?? "";
    const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
    const sessionToken = match?.[1];

    if (!sessionToken) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const me = await UserAPI.getMe(sessionToken);
    if (!me) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const daysParam = url.searchParams.get("days");
    const days = daysParam ? Number(daysParam) : 7;

    const dashboard = await NoteGenerationAPI.getDashboard(new ObjectId(me.id), days);
    return NextResponse.json(dashboard);
}