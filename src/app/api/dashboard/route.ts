// src/app/api/dashboard/route.ts
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { cookies } from "next/headers";

import { UserAPI } from "@/server/api/UserAPI";
import { NoteGenerationAPI } from "@/server/api/NoteGenerationAPI";

const SESSION_COOKIE = "np_session";

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;

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

  const dashboard = await NoteGenerationAPI.getDashboard(new ObjectId(me.id), days, 4);
  return NextResponse.json(dashboard);
}