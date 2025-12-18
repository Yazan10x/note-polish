import { NextResponse } from "next/server";

import { SignupInputSchema } from "@/lib/models/user";
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

  const parsed = SignupInputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  try {
    const { user, sessionToken } = await UserAPI.signup(parsed.data);

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
    const message = e instanceof Error ? e.message : "Signup failed";
    const status = message === "Email already in use" ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
