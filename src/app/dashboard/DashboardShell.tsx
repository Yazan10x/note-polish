"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Home, LineChart, Package, Search, Settings, Moon, Sun } from "lucide-react";

import type { PublicUser } from "@/lib/models/user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function DashboardShell({
                                           user,
                                           children,
                                       }: {
    user: PublicUser;
    children: React.ReactNode;
}) {
    const router = useRouter();
    const pathname = usePathname();

    const [signOutError, setSignOutError] = useState<string | null>(null);

    const displayUser = useMemo(() => user, [user]);

    async function onSignOut() {
        setSignOutError(null);
        try {
            await fetch("/api/auth/logout", { method: "POST" });
            router.push("/");
            router.refresh();
        } catch {
            setSignOutError("Sign out failed");
        }
    }

    return (
        <div className="min-h-screen bg-white text-black dark:bg-black dark:text-white">
            <div className="flex min-h-screen">
                <aside className="hidden w-64 flex-col border-r border-zinc-200/70 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-white/5 md:flex">
                    <div className="flex items-center gap-3 px-6 py-5">
                        <Image src="/icon.png" alt="Note Polish" width={30} height={30} priority />
                        <div className="leading-tight">
                            <div className="text-sm font-semibold">Note Polisher</div>
                            <div className="text-xs text-zinc-600 dark:text-zinc-400">Dashboard</div>
                        </div>
                    </div>

                    <nav className="flex-1 px-3 py-2">
                        <NavItem active={isActive(pathname, "/dashboard")} href="/dashboard" icon={<Home className="h-4 w-4" />}>
                            Overview
                        </NavItem>
                        <NavItem
                            active={isActive(pathname, "/dashboard/playground")}
                            href="/dashboard/playground"
                            icon={<Package className="h-4 w-4" />}
                        >
                            Playground
                        </NavItem>
                        <NavItem
                            active={isActive(pathname, "/dashboard/history")}
                            href="/dashboard/history"
                            icon={<LineChart className="h-4 w-4" />}
                        >
                            History
                        </NavItem>
                        {/*<NavItem*/}
                        {/*    active={isActive(pathname, "/dashboard/settings")}*/}
                        {/*    href="/dashboard/settings"*/}
                        {/*    icon={<Settings className="h-4 w-4" />}*/}
                        {/*>*/}
                        {/*    Settings*/}
                        {/*</NavItem>*/}
                    </nav>

                    <div className="border-t border-zinc-200/70 px-6 py-4 text-xs text-zinc-600 dark:border-white/10 dark:text-zinc-400">
                        Signed in as <span className="font-medium">{displayUser.full_name}</span>
                        <div className="mt-1">{displayUser.email}</div>
                    </div>
                </aside>

                <main className="flex-1">
                    <header className="sticky top-0 z-10 border-b border-zinc-200/70 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-black/30">
                        <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-4">
                            <div className="flex flex-1 items-center gap-2">
                                <div className="relative w-full max-w-md">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                                    <Input className="pl-9" placeholder="Search generations..." />
                                </div>
                            </div>

                            <ThemeToggle />

                            <Button variant="ghost" size="icon" aria-label="Notifications">
                                <Bell className="h-5 w-5" />
                            </Button>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="gap-3 px-2">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200/70 bg-white/70 text-xs font-semibold dark:border-white/10 dark:bg-white/5">
                                            {initials(displayUser.full_name)}
                                        </div>
                                        <div className="hidden text-left md:block">
                                            <div className="text-sm font-medium leading-none">{displayUser.full_name}</div>
                                            <div className="text-xs text-zinc-600 dark:text-zinc-400">{displayUser.email}</div>
                                        </div>
                                    </Button>
                                </DropdownMenuTrigger>

                                <DropdownMenuContent align="end" className="w-56">
                                    <DropdownMenuLabel>Account</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem asChild>
                                        <Link href="/dashboard/settings">Settings</Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                        <button type="button" className="w-full text-left" onClick={onSignOut}>
                                            Sign out
                                        </button>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </header>

                    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
                        {signOutError ? (
                            <div className="rounded-lg border border-zinc-200/70 bg-white/60 px-3 py-2 text-sm text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
                                {signOutError}
                            </div>
                        ) : null}

                        {children}

                        <footer className="mt-16 border-t border-zinc-200/70 pt-6 text-xs text-zinc-500 dark:border-white/10 dark:text-zinc-500">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>© {new Date().getFullYear()} Note Polish</div>
                                <div>
                                    Built by{" "}
                                    <a
                                        href="https://armoush.com"
                                        target="_blank"
                                        rel="noreferrer"
                                        className="font-medium text-zinc-900 underline underline-offset-4 dark:text-zinc-100"
                                    >
                                        Yazan Armoush
                                    </a>
                                </div>
                            </div>
                        </footer>
                    </div>
                </main>
            </div>
        </div>
    );
}

function isActive(pathname: string | null, href: string) {
    if (!pathname) return false;
    if (pathname === href) return true;
    return pathname.startsWith(href + "/");
}

function ThemeToggle() {
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        const root = document.documentElement;

        const saved = localStorage.getItem("theme");
        if (saved === "dark") {
            root.classList.add("dark");
            setIsDark(true);
            return;
        }
        if (saved === "light") {
            root.classList.remove("dark");
            setIsDark(false);
            return;
        }

        const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
        if (prefersDark) root.classList.add("dark");
        setIsDark(prefersDark);
    }, []);

    function toggle() {
        const root = document.documentElement;
        const next = !root.classList.contains("dark");

        if (next) {
            root.classList.add("dark");
            localStorage.setItem("theme", "dark");
            setIsDark(true);
        } else {
            root.classList.remove("dark");
            localStorage.setItem("theme", "light");
            setIsDark(false);
        }
    }

    return (
        <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={toggle}>
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
    );
}

function NavItem({
                     href,
                     icon,
                     active,
                     children,
                 }: {
    href: string;
    icon: React.ReactNode;
    active: boolean;
    children: React.ReactNode;
}) {
    return (
        <Link
            href={href}
            className={[
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm",
                active
                    ? "bg-zinc-100/80 text-zinc-900 dark:bg-white/10 dark:text-white"
                    : "text-zinc-700 hover:bg-zinc-100/70 dark:text-zinc-300 dark:hover:bg-white/10",
            ].join(" ")}
        >
            {icon}
            <span>{children}</span>
        </Link>
    );
}

function initials(fullName: string) {
    const parts = fullName.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? "";
    const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (first + last).toUpperCase();
}