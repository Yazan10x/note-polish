import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { UserAPI } from "@/server/api/UserAPI";
import type { PublicUser } from "@/lib/models/user";

import DashboardShell from "./DashboardShell";

const SESSION_COOKIE = "np_session";

export default async function DashboardLayout({
                                                  children,
                                              }: {
    children: React.ReactNode;
}) {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;

    if (!token) redirect("/login");

    const user = (await UserAPI.getMe(token)) as PublicUser | null;
    if (!user) redirect("/login");

    return <DashboardShell user={user}>{children}</DashboardShell>;
}