// src/app/dashboard/history/page.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, RefreshCw } from "lucide-react";

import type { PublicNoteGeneration } from "@/lib/models/noteGeneration";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

type ListResponse =
    | { items: PublicNoteGeneration[]; total: number }
    | PublicNoteGeneration[];

const PAGE_SIZE = 12;

const STATUS_OPTIONS = [
    { key: "all", label: "All statuses" },
    { key: "queued", label: "Queued" },
    { key: "processing", label: "Processing" },
    { key: "processed", label: "Processed" },
    { key: "failed", label: "Failed" },
] as const;

export default function HistoryPage() {
    const router = useRouter();

    const [query, setQuery] = useState("");
    const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]["key"]>("all");
    const [page, setPage] = useState(1);

    const [reloadKey, setReloadKey] = useState(0);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [items, setItems] = useState<PublicNoteGeneration[]>([]);
    const [total, setTotal] = useState(0);

    const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});

    const selectedCount = useMemo(() => Object.values(selectedIds).filter(Boolean).length, [selectedIds]);

    const allSelectedOnPage = useMemo(() => {
        if (!items.length) return false;
        return items.every((g) => selectedIds[g.id]);
    }, [items, selectedIds]);

    function triggerReload() {
        setReloadKey((k) => k + 1);
    }

    useEffect(() => {
        let cancelled = false;

        async function load() {
            setLoading(true);
            setError(null);

            try {
                const params = new URLSearchParams();
                params.set("page", String(page));
                params.set("page_size", String(PAGE_SIZE));
                if (query.trim()) params.set("q", query.trim());
                if (status !== "all") params.set("status", status);

                const res = await fetch(`/api/generations?${params.toString()}`, {
                    method: "GET",
                    cache: "no-store",
                });
                if (!res.ok) {
                    const data = await safeJson(res);
                    throw new Error(data?.error || "Failed to load history");
                }

                const data = (await res.json()) as ListResponse;

                const nextItems = Array.isArray(data) ? data : data.items;
                const nextTotal = Array.isArray(data) ? data.length : data.total;

                if (cancelled) return;

                setItems(nextItems ?? []);
                setTotal(Number.isFinite(nextTotal) ? nextTotal : (nextItems?.length ?? 0));
                setSelectedIds({});
            } catch (e) {
                if (cancelled) return;
                setError(e instanceof Error ? e.message : "Failed to load history");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => {
            cancelled = true;
        };
    }, [page, query, status, reloadKey]);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    function toggleAllOnPage(next: boolean) {
        const nextState: Record<string, boolean> = { ...selectedIds };
        for (const g of items) nextState[g.id] = next;
        setSelectedIds(nextState);
    }

    function toggleOne(id: string, next: boolean) {
        setSelectedIds((prev) => ({ ...prev, [id]: next }));
    }

    async function deleteOne(id: string) {
        setError(null);

        try {
            const res = await fetch(`/api/generations/${id}`, { method: "DELETE" });
            if (!res.ok) {
                const data = await safeJson(res);
                throw new Error(data?.error || "Delete failed");
            }

            // Optimistic UI update so the row disappears immediately
            setItems((prev) => {
                const next = prev.filter((g) => g.id !== id);

                // If we deleted the last row on a non-first page, move back a page and reload
                if (next.length === 0 && page > 1) {
                    setPage((p) => Math.max(1, p - 1));
                } else {
                    triggerReload();
                }

                return next;
            });

            setTotal((t) => Math.max(0, t - 1));
            setSelectedIds((prev) => {
                const next = { ...prev };
                delete next[id];
                return next;
            });

            // If you want to always jump to page 1 after delete, keep this.
            // It now reliably triggers a reload even when page is already 1.
            setPage(1);
            triggerReload();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Delete failed");
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">History</h1>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        Your previous generations, outputs, and settings.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        className="gap-2"
                        onClick={() => {
                            setPage(1);
                            triggerReload();
                            router.refresh();
                        }}
                    >
                        <RefreshCw className="h-4 w-4" />
                        Refresh
                    </Button>
                </div>
            </div>

            {error ? (
                <div className="rounded-lg border border-zinc-200/70 bg-white/60 px-3 py-2 text-sm text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
                    {error}
                </div>
            ) : null}

            <Card className="border-zinc-200/70 bg-white/70 dark:border-white/10 dark:bg-white/5">
                <CardHeader className="space-y-3">
                    <CardTitle className="text-base">Generations</CardTitle>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-1 items-center gap-2">
                            <Input
                                value={query}
                                onChange={(e) => {
                                    setQuery(e.target.value);
                                    setPage(1);
                                }}
                                placeholder="Search titles, ids, or notes..."
                                className="max-w-md"
                            />

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline">
                                        {STATUS_OPTIONS.find((s) => s.key === status)?.label ?? "Status"}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-48">
                                    <DropdownMenuLabel>Filter</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {STATUS_OPTIONS.map((opt) => (
                                        <DropdownMenuItem
                                            key={opt.key}
                                            onSelect={(e) => {
                                                e.preventDefault();
                                                setStatus(opt.key);
                                                setPage(1);
                                            }}
                                        >
                                            {opt.label}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        <div className="text-sm text-zinc-600 dark:text-zinc-400">{selectedCount} selected</div>
                    </div>
                </CardHeader>

                <CardContent>
                    <div className="rounded-lg border border-zinc-200/70 dark:border-white/10">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-10">
                                        <Checkbox
                                            checked={allSelectedOnPage}
                                            onCheckedChange={(v) => toggleAllOnPage(Boolean(v))}
                                            aria-label="Select all rows"
                                        />
                                    </TableHead>
                                    <TableHead>Generation</TableHead>
                                    <TableHead className="hidden md:table-cell">Style</TableHead>
                                    <TableHead className="hidden md:table-cell">Created</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="w-12 text-right"> </TableHead>
                                </TableRow>
                            </TableHeader>

                            <TableBody>
                                {loading ? (
                                    Array.from({ length: 6 }).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell>
                                                <div className="h-4 w-4 rounded bg-zinc-200/70 dark:bg-white/10" />
                                            </TableCell>
                                            <TableCell>
                                                <div className="h-4 w-64 rounded bg-zinc-200/70 dark:bg-white/10" />
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell">
                                                <div className="h-4 w-32 rounded bg-zinc-200/70 dark:bg-white/10" />
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell">
                                                <div className="h-4 w-28 rounded bg-zinc-200/70 dark:bg-white/10" />
                                            </TableCell>
                                            <TableCell>
                                                <div className="h-4 w-20 rounded bg-zinc-200/70 dark:bg-white/10" />
                                            </TableCell>
                                            <TableCell />
                                        </TableRow>
                                    ))
                                ) : items.length ? (
                                    items.map((g) => {
                                        const title = (g as any).title || "Untitled";
                                        const createdAt =
                                            (g as any).created_at || (g as any).createdAt || (g as any).created;

                                        const statusLabel =
                                            String((g as any).status || "unknown").replaceAll("_", " ").trim() ||
                                            "unknown";

                                        const styleLabel = formatStyle(g);

                                        const previewUrl =
                                            (g as any).output_image_url ||
                                            (g as any).preview_image_url ||
                                            (g as any).image_url ||
                                            null;

                                        const href = `/dashboard/history/${encodeURIComponent(g.id)}`;

                                        return (
                                            <TableRow
                                                key={g.id}
                                                className="cursor-pointer hover:bg-zinc-50/70 dark:hover:bg-white/5"
                                                onClick={() => router.push(href)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter" || e.key === " ") router.push(href);
                                                }}
                                                tabIndex={0}
                                                role="button"
                                            >
                                                <TableCell onClick={(e) => e.stopPropagation()}>
                                                    <Checkbox
                                                        checked={Boolean(selectedIds[g.id])}
                                                        onCheckedChange={(v) => toggleOne(g.id, Boolean(v))}
                                                        aria-label="Select row"
                                                    />
                                                </TableCell>

                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <div className="relative h-10 w-10 overflow-hidden rounded-md border border-zinc-200/70 bg-white dark:border-white/10 dark:bg-white/5">
                                                            {previewUrl ? (
                                                                <Image src={previewUrl} alt="" fill className="object-cover" />
                                                            ) : (
                                                                <div className="h-full w-full" />
                                                            )}
                                                        </div>

                                                        <div className="min-w-0">
                                                            <div className="truncate text-sm font-medium">{title}</div>
                                                            <div className="truncate text-xs text-zinc-600 dark:text-zinc-400">
                                                                {g.id}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </TableCell>

                                                <TableCell className="hidden md:table-cell">
                                                    <span className="text-sm text-zinc-700 dark:text-zinc-300">
                                                        {styleLabel}
                                                    </span>
                                                </TableCell>

                                                <TableCell className="hidden md:table-cell">
                                                    <span className="text-sm text-zinc-700 dark:text-zinc-300">
                                                        {createdAt ? formatDate(createdAt) : "—"}
                                                    </span>
                                                </TableCell>

                                                <TableCell>
                                                    <StatusPill value={statusLabel} />
                                                </TableCell>

                                                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                aria-label="Open menu"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>

                                                        <DropdownMenuContent
                                                            align="end"
                                                            className="w-44"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem onSelect={() => router.push(href)}>
                                                                Open
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                onSelect={(e) => {
                                                                    e.preventDefault();
                                                                    navigator.clipboard?.writeText(g.id);
                                                                }}
                                                            >
                                                                Copy id
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                className="text-red-600 focus:text-red-600"
                                                                onSelect={(e) => {
                                                                    e.preventDefault();
                                                                    void deleteOne(g.id);
                                                                }}
                                                            >
                                                                Delete
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={6}>
                                            <div className="flex flex-col items-center gap-2 py-10 text-center">
                                                <div className="text-sm font-medium">No generations yet</div>
                                                <div className="text-sm text-zinc-600 dark:text-zinc-400">
                                                    Create one in Playground and it will show up here.
                                                </div>
                                                <Button asChild className="mt-2">
                                                    <Link href="/dashboard/playground">Go to Playground</Link>
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-sm text-zinc-600 dark:text-zinc-400">
                            Page {page} of {totalPages}
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                disabled={page <= 1 || loading}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                            >
                                Previous
                            </Button>
                            <Button
                                variant="outline"
                                disabled={page >= totalPages || loading}
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function formatDate(v: string | Date) {
    const d = v instanceof Date ? v : new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

/**
 * Show the preset title, not the preset id.
 * Uses snapshot_title stored on the generation (best), falls back gracefully.
 */
function formatStyle(g: PublicNoteGeneration) {
    const style = (g as any).style;

    if (style?.mode === "custom") {
        return style?.snapshot_title || "Custom";
    }

    if (style?.mode === "preset") {
        return style?.snapshot_title || "Preset";
    }

    const legacySnapshot = (g as any)?.snapshot_title;
    if (legacySnapshot) return String(legacySnapshot);

    return "Preset";
}

function StatusPill({ value }: { value: string }) {
    const v = value.toLowerCase();

    const cls =
        v.includes("succeed") || v === "done"
            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            : v.includes("fail") || v.includes("error")
                ? "bg-red-500/10 text-red-700 dark:text-red-300"
                : v.includes("process") || v.includes("run")
                    ? "bg-blue-500/10 text-blue-700 dark:text-blue-300"
                    : v.includes("pending")
                        ? "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300"
                        : "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300";

    return (
        <span className={["inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", cls].join(" ")}>
            {value}
        </span>
    );
}

async function safeJson(res: Response) {
    try {
        return await res.json();
    } catch {
        return null;
    }
}