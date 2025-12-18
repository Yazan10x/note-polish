import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { UserAPI } from "@/server/api/UserAPI";

const SESSION_COOKIE = "np_session";

export async function GET() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await UserAPI.getMe(token);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ user });
}
