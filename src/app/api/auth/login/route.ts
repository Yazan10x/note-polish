import { NextResponse } from "next/server";

import { LoginInputSchema } from "@/lib/models/user";
import { UserAPI } from "@/server/api/UserAPI";

const SESSION_COOKIE = "np_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = LoginInputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  try {
    const { user, sessionToken } = await UserAPI.login(parsed.data);

    const res = NextResponse.json({ user });
    res.cookies.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Login failed";
    const status = message === "Invalid email or password" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
