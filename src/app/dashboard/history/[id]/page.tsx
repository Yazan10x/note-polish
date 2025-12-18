// src/app/dashboard/history/[id]/page.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Copy, ExternalLink, MoreHorizontal } from "lucide-react";

import type { PublicNoteGeneration } from "@/lib/models/noteGeneration";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function HistoryResultPage() {
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const id = params?.id;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [gen, setGen] = useState<PublicNoteGeneration | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            if (!id) return;

            setLoading(true);
            setError(null);

            try {
                const res = await fetch(`/api/generations/${encodeURIComponent(id)}`, { method: "GET" });
                if (!res.ok) {
                    const data = await safeJson(res);
                    throw new Error(data?.error || "Failed to load generation");
                }
                const data = (await res.json()) as PublicNoteGeneration;

                if (cancelled) return;
                setGen(data);
            } catch (e) {
                if (cancelled) return;
                setError(e instanceof Error ? e.message : "Failed to load generation");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => {
            cancelled = true;
        };
    }, [id]);

    const title = useMemo(() => (gen as any)?.title || "Generation", [gen]);
    const createdAt = useMemo(() => (gen as any)?.created_at || (gen as any)?.createdAt || null, [gen]);
    const statusLabel = useMemo(
        () =>
            String((gen as any)?.status || "unknown")
                .replaceAll("_", " ")
                .trim() || "unknown",
        [gen]
    );

    const outputImageUrl =
        (gen as any)?.output_image_url ||
        (gen as any)?.outputImageUrl ||
        (gen as any)?.result_image_url ||
        null;

    const outputText =
        (gen as any)?.output_text ||
        (gen as any)?.outputText ||
        (gen as any)?.result_text ||
        null;

    const inputText =
        (gen as any)?.input_text ||
        (gen as any)?.inputText ||
        null;

    const styleLabel = useMemo(() => formatStyle(gen), [gen]);

    async function onDelete() {
        if (!id) return;
        setError(null);
        try {
            const res = await fetch(`/api/generations/${encodeURIComponent(id)}`, { method: "DELETE" });
            if (!res.ok) {
                const data = await safeJson(res);
                throw new Error(data?.error || "Delete failed");
            }
            router.push("/dashboard/history");
            router.refresh();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Delete failed");
        }
    }

    function onCopy(text: string) {
        try {
            navigator.clipboard?.writeText(text);
        } catch {
            // ignore
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <Button asChild variant="ghost" className="gap-2 px-2">
                            <Link href="/dashboard/history">
                                <ArrowLeft className="h-4 w-4" />
                                Back
                            </Link>
                        </Button>

                        {loading ? (
                            <div className="h-6 w-40 rounded bg-zinc-200/70 dark:bg-white/10" />
                        ) : (
                            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                        {gen ? (
                            <>
                                <StatusPill value={statusLabel} />
                                <span>Style: {styleLabel}</span>
                                <span>Created: {createdAt ? formatDate(createdAt) : "—"}</span>
                                <span className="truncate">Id: {gen.id}</span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Copy id"
                                    onClick={() => onCopy(gen.id)}
                                >
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </>
                        ) : null}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {gen ? (
                        <>
                            <Button asChild variant="outline" className="gap-2">
                                <Link href={`/dashboard/playground?from=${encodeURIComponent(gen.id)}`}>
                                    <ExternalLink className="h-4 w-4" />
                                    Open in Playground
                                </Link>
                            </Button>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="icon" aria-label="Open menu">
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        onSelect={(e) => {
                                            e.preventDefault();
                                            onCopy(gen.id);
                                        }}
                                    >
                                        Copy id
                                    </DropdownMenuItem>
                                    {outputImageUrl ? (
                                        <DropdownMenuItem asChild>
                                            <a href={outputImageUrl} target="_blank" rel="noreferrer">
                                                Open output image
                                            </a>
                                        </DropdownMenuItem>
                                    ) : null}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        className="text-red-600 focus:text-red-600"
                                        onSelect={(e) => {
                                            e.preventDefault();
                                            void onDelete();
                                        }}
                                    >
                                        Delete
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </>
                    ) : null}
                </div>
            </div>

            {error ? (
                <div className="rounded-lg border border-zinc-200/70 bg-white/60 px-3 py-2 text-sm text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
                    {error}
                </div>
            ) : null}

            <Card className="border-zinc-200/70 bg-white/70 dark:border-white/10 dark:bg-white/5">
                <CardHeader>
                    <CardTitle className="text-base">Result</CardTitle>
                </CardHeader>

                <CardContent>
                    {loading ? (
                        <div className="space-y-3">
                            <div className="h-10 w-72 rounded bg-zinc-200/70 dark:bg-white/10" />
                            <div className="h-64 w-full rounded bg-zinc-200/70 dark:bg-white/10" />
                        </div>
                    ) : gen ? (
                        <Tabs defaultValue="output">
                            <TabsList>
                                <TabsTrigger value="output">Output</TabsTrigger>
                                <TabsTrigger value="input">Input</TabsTrigger>
                                <TabsTrigger value="details">Details</TabsTrigger>
                            </TabsList>

                            <TabsContent value="output" className="mt-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <Card className="border-zinc-200/70 dark:border-white/10">
                                        <CardHeader>
                                            <CardTitle className="text-sm">Output Image</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            {outputImageUrl ? (
                                                <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-zinc-200/70 bg-white dark:border-white/10 dark:bg-white/5">
                                                    <Image
                                                        src={outputImageUrl}
                                                        alt="Output"
                                                        fill
                                                        className="object-contain"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="rounded-lg border border-zinc-200/70 bg-white/60 px-3 py-2 text-sm text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
                                                    No output image found for this generation.
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>

                                    <Card className="border-zinc-200/70 dark:border-white/10">
                                        <CardHeader>
                                            <CardTitle className="text-sm">Output Text</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            {outputText ? (
                                                <pre className="whitespace-pre-wrap break-words rounded-lg border border-zinc-200/70 bg-white/60 p-3 text-sm text-zinc-800 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">
                                                    {String(outputText)}
                                                </pre>
                                            ) : (
                                                <div className="rounded-lg border border-zinc-200/70 bg-white/60 px-3 py-2 text-sm text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
                                                    No output text found for this generation.
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </div>
                            </TabsContent>

                            <TabsContent value="input" className="mt-4">
                                <Card className="border-zinc-200/70 dark:border-white/10">
                                    <CardHeader>
                                        <CardTitle className="text-sm">Input Text</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        {inputText ? (
                                            <pre className="whitespace-pre-wrap break-words rounded-lg border border-zinc-200/70 bg-white/60 p-3 text-sm text-zinc-800 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">
                                                {String(inputText)}
                                            </pre>
                                        ) : (
                                            <div className="rounded-lg border border-zinc-200/70 bg-white/60 px-3 py-2 text-sm text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
                                                No input text stored for this generation.
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="details" className="mt-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <Card className="border-zinc-200/70 dark:border-white/10">
                                        <CardHeader>
                                            <CardTitle className="text-sm">Metadata</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-2 text-sm">
                                            <Row label="Id" value={gen.id} onCopy={() => onCopy(gen.id)} />
                                            <Row label="Title" value={(gen as any)?.title || "Untitled"} />
                                            <Row label="Status" value={statusLabel} />
                                            <Row label="Style" value={styleLabel} />
                                            <Row label="Created" value={createdAt ? formatDate(createdAt) : "—"} />
                                        </CardContent>
                                    </Card>

                                    <Card className="border-zinc-200/70 dark:border-white/10">
                                        <CardHeader>
                                            <CardTitle className="text-sm">Raw JSON</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <pre className="max-h-[380px] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-zinc-200/70 bg-white/60 p-3 text-xs text-zinc-800 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">
                                                {JSON.stringify(gen, null, 2)}
                                            </pre>
                                        </CardContent>
                                    </Card>
                                </div>
                            </TabsContent>
                        </Tabs>
                    ) : (
                        <div className="rounded-lg border border-zinc-200/70 bg-white/60 px-3 py-2 text-sm text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
                            Not found.
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function Row({ label, value, onCopy }: { label: string; value: string; onCopy?: () => void }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <div className="text-zinc-600 dark:text-zinc-400">{label}</div>
            <div className="flex items-center gap-2">
                <div className="max-w-[380px] truncate font-medium text-zinc-900 dark:text-zinc-100">{value}</div>
                {onCopy ? (
                    <Button variant="ghost" size="icon" aria-label={`Copy ${label}`} onClick={onCopy}>
                        <Copy className="h-4 w-4" />
                    </Button>
                ) : null}
            </div>
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

function formatStyle(gen: PublicNoteGeneration | null) {
    if (!gen) return "—";
    const style = (gen as any).style;
    if (style?.mode === "custom") return "Custom";
    if (style?.mode === "preset") {
        const preset = style?.preset_id || style?.presetId || "Preset";
        return `Preset: ${preset}`;
    }

    const presetId = (gen as any).preset_id || (gen as any).presetId;
    const customPrompt = (gen as any).custom_prompt || (gen as any).customPrompt;
    if (customPrompt) return "Custom";
    if (presetId) return `Preset: ${presetId}`;

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
                    : v.includes("queue") || v.includes("pending")
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