"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Home, LineChart, Package, Search, Settings, Moon, Sun } from "lucide-react";

import type { PublicUser } from "@/lib/models/user";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type DashboardStatus = "pending" | "processing" | "processed" | "failed";

type DashboardResponse = {
    period_days: number;
    metrics: {
        generations_last_period: number;
        downloads_last_period: number;
        favourites_total: number;
        active_styles: number;
    };
    recent_generations: Array<{
        id: string;
        title: string;
        style_label: string;
        status: DashboardStatus;
        created_at: string; // ISO
    }>;
    quick_actions: Array<{
        key: "open_playground" | "view_history";
        title: string;
        href: string;
    }>;
};

export default function DashboardPage() {
    const router = useRouter();

    const [user, setUser] = useState<PublicUser | null>(null);
    const [isLoadingUser, setIsLoadingUser] = useState(true);
    const [signOutError, setSignOutError] = useState<string | null>(null);

    const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
    const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
    const [dashboardError, setDashboardError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                const res = await fetch("/api/me", { method: "GET" });

                if (res.status === 401) {
                    router.replace("/login");
                    return;
                }

                if (!res.ok) {
                    router.replace("/login");
                    return;
                }

                const data = (await res.json()) as { user: PublicUser };
                if (!cancelled) setUser(data.user);
            } catch {
                router.replace("/login");
            } finally {
                if (!cancelled) setIsLoadingUser(false);
            }
        }

        load();
        return () => {
            cancelled = true;
        };
    }, [router]);

    useEffect(() => {
        if (isLoadingUser) return;
        if (!user) return;

        let cancelled = false;

        async function loadDashboard() {
            setDashboardError(null);
            setIsLoadingDashboard(true);

            try {
                const res = await fetch("/api/dashboard", {
                    method: "GET",
                    cache: "no-store",
                });

                if (res.status === 401) {
                    router.replace("/login");
                    return;
                }

                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    setDashboardError(data?.error ?? "Failed to load dashboard");
                    return;
                }

                const data = (await res.json()) as DashboardResponse;
                if (!cancelled) setDashboard(data);
            } catch {
                if (!cancelled) setDashboardError("Failed to load dashboard");
            } finally {
                if (!cancelled) setIsLoadingDashboard(false);
            }
        }

        loadDashboard();

        return () => {
            cancelled = true;
        };
    }, [isLoadingUser, user, router]);

    const displayUser = useMemo(() => {
        if (user) return user;
        return {
            id: "",
            full_name: "User",
            email: "",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        } satisfies PublicUser;
    }, [user]);

    const statDaysLabel = useMemo(() => {
        const d = dashboard?.period_days ?? 7;
        return `Last ${d} days`;
    }, [dashboard?.period_days]);

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

    if (isLoadingUser) {
        return (
            <div className="min-h-screen bg-white text-black dark:bg-black dark:text-white">
                <div className="mx-auto max-w-6xl px-6 py-10 text-sm text-zinc-600 dark:text-zinc-400">
                    Loading...
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white text-black dark:bg-black dark:text-white">
            <div className="flex min-h-screen">
                <aside className="hidden w-64 flex-col border-r border-zinc-200/70 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-white/5 md:flex">
                    <div className="flex items-center gap-3 px-6 py-5">
                        <Image src="/icon.png" alt="Note Polish" width={30} height={30} priority />
                        <div className="leading-tight">
                            <div className="text-sm font-semibold">Note Polish</div>
                            <div className="text-xs text-zinc-600 dark:text-zinc-400">Dashboard</div>
                        </div>
                    </div>

                    <nav className="flex-1 px-3 py-2">
                        <NavItem href="/dashboard" icon={<Home className="h-4 w-4" />}>
                            Overview
                        </NavItem>
                        <NavItem href="/dashboard/history" icon={<LineChart className="h-4 w-4" />}>
                            History
                        </NavItem>
                        <NavItem href="/dashboard/playground" icon={<Package className="h-4 w-4" />}>
                            Playground
                        </NavItem>
                        <NavItem href="/dashboard/settings" icon={<Settings className="h-4 w-4" />}>
                            Settings
                        </NavItem>
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

                        {dashboardError ? (
                            <div className="rounded-lg border border-zinc-200/70 bg-white/60 px-3 py-2 text-sm text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
                                {dashboardError}
                            </div>
                        ) : null}

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
                                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                    Recent activity and quick actions.
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <Button asChild variant="outline">
                                    <Link href="/dashboard/history">View history</Link>
                                </Button>
                                <Button asChild>
                                    <Link href="/dashboard/playground">Open playground</Link>
                                </Button>
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <StatCard
                                title="Generations"
                                value={String(dashboard?.metrics.generations_last_period ?? (isLoadingDashboard ? "…" : 0))}
                                hint={statDaysLabel}
                            />
                            <StatCard
                                title="Downloads"
                                value={String(dashboard?.metrics.downloads_last_period ?? (isLoadingDashboard ? "…" : 0))}
                                hint={statDaysLabel}
                            />
                            <StatCard
                                title="Favorites"
                                value={String(dashboard?.metrics.favourites_total ?? (isLoadingDashboard ? "…" : 0))}
                                hint="Saved outputs"
                            />
                            <StatCard
                                title="Active styles"
                                value={String(dashboard?.metrics.active_styles ?? (isLoadingDashboard ? "…" : 0))}
                                hint="Available presets"
                            />
                        </div>

                        <div className="grid gap-4 lg:grid-cols-3">
                            <Card className="lg:col-span-2 border-zinc-200/70 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-white/5">
                                <CardHeader>
                                    <CardTitle className="text-base">Recent generations</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {isLoadingDashboard ? (
                                        <>
                                            <Row title="Loading…" meta="" />
                                            <Row title="Loading…" meta="" />
                                            <Row title="Loading…" meta="" />
                                        </>
                                    ) : (dashboard?.recent_generations?.length ?? 0) > 0 ? (
                                        dashboard!.recent_generations.map((g) => (
                                            <Row
                                                key={g.id}
                                                title={g.title}
                                                meta={`${g.style_label}, ${relativeTime(g.created_at)}`}
                                            />
                                        ))
                                    ) : (
                                        <div className="rounded-lg border border-zinc-200/70 bg-white/60 px-4 py-3 text-sm text-zinc-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-400">
                                            No generations yet. Create your first one in Playground.
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="border-zinc-200/70 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-white/5">
                                <CardHeader>
                                    <CardTitle className="text-base">Quick actions</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <Button asChild className="w-full">
                                        <Link href="/dashboard/playground">Create new sheet</Link>
                                    </Button>
                                    <Button asChild variant="outline" className="w-full">
                                        <Link href="/dashboard/history">Open history</Link>
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>

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
                     children,
                 }: {
    href: string;
    icon: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <Link
            href={href}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100/70 dark:text-zinc-300 dark:hover:bg-white/10"
        >
            {icon}
            <span>{children}</span>
        </Link>
    );
}

function StatCard({ title, value, hint }: { title: string; value: string; hint: string }) {
    return (
        <Card className="border-zinc-200/70 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-white/5">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{title}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-semibold">{value}</div>
                <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{hint}</div>
            </CardContent>
        </Card>
    );
}

function Row({ title, meta }: { title: string; meta: string }) {
    return (
        <div className="flex items-center justify-between rounded-lg border border-zinc-200/70 bg-white/60 px-4 py-3 text-sm dark:border-white/10 dark:bg-white/5">
            <div className="font-medium">{title}</div>
            <div className="text-xs text-zinc-600 dark:text-zinc-400">{meta}</div>
        </div>
    );
}

function initials(fullName: string) {
    const parts = fullName.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? "";
    const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (first + last).toUpperCase();
}

function relativeTime(iso: string): string {
    const ts = Date.parse(iso);
    if (!Number.isFinite(ts)) return "just now";

    const diffMs = ts - Date.now();
    const diffSec = Math.round(diffMs / 1000);

    const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

    const abs = Math.abs(diffSec);
    if (abs < 60) return rtf.format(diffSec, "second");

    const diffMin = Math.round(diffSec / 60);
    if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute");

    const diffHr = Math.round(diffMin / 60);
    if (Math.abs(diffHr) < 24) return rtf.format(diffHr, "hour");

    const diffDay = Math.round(diffHr / 24);
    return rtf.format(diffDay, "day");
}