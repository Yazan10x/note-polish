"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
        created_at: string;
    }>;
    quick_actions: Array<{
        key: "open_playground" | "view_history";
        title: string;
        href: string;
    }>;
};

export default function DashboardPage() {
    const router = useRouter();

    const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
    const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
    const [dashboardError, setDashboardError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function loadDashboard() {
            setDashboardError(null);
            setIsLoadingDashboard(true);

            try {
                const res = await fetch("/api/dashboard?limit=4", {
                    method: "GET",
                    cache: "no-store",
                });

                if (res.status === 401) {
                    router.replace("/login");
                    return;
                }

                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    if (!cancelled) setDashboardError(data?.error ?? "Failed to load dashboard");
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
    }, [router]);

    const statDaysLabel = useMemo(() => {
        const d = dashboard?.period_days ?? 7;
        return `Last ${d} days`;
    }, [dashboard?.period_days]);

    return (
        <div className="space-y-6">
            {dashboardError ? (
                <div className="rounded-lg border border-zinc-200/70 bg-white/60 px-3 py-2 text-sm text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
                    {dashboardError}
                </div>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">Recent activity and quick actions.</p>
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
                    hint="Presets used"
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
                                <Row title="Loading…" meta="" />
                            </>
                        ) : (dashboard?.recent_generations?.length ?? 0) > 0 ? (
                            dashboard!.recent_generations.map((g) => (
                                <Row key={g.id} title={g.title} meta={`${g.style_label}, ${relativeTime(g.created_at)}`} />
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
        </div>
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