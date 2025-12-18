import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { UserAPI } from "@/server/api/UserAPI";

const SESSION_COOKIE = "np_session";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await UserAPI.logout(token);
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return res;
}