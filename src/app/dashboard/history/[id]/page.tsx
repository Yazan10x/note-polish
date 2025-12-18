// src/app/dashboard/history/[id]/page.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    ArrowLeft,
    Copy,
    ExternalLink,
    MoreHorizontal,
    Trash2,
    Calendar,
    Palette,
    Hash,
    Image as ImageIcon,
    File,
} from "lucide-react";

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

    const rawId = params?.id ?? "";
    const id = useMemo(() => {
        const m = String(rawId).match(/[a-f0-9]{24}/i);
        return (m?.[0] ?? rawId).trim();
    }, [rawId]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [gen, setGen] = useState<PublicNoteGeneration | null>(null);
    const [copied, setCopied] = useState<string | null>(null);

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

    const statusValue = useMemo(
        () => String((gen as any)?.status || "unknown").trim() || "unknown",
        [gen]
    );
    const statusLabel = useMemo(() => statusValue.replaceAll("_", " ").trim() || "unknown", [statusValue]);

    const styleLabel = useMemo(() => formatStyle(gen), [gen]);

    const inputText = useMemo(() => (gen as any)?.input_text || (gen as any)?.inputText || null, [gen]);

    const outputFiles = useMemo(() => {
        const g: any = gen;
        const files = g?.output_files;
        return Array.isArray(files) ? (files as string[]) : [];
    }, [gen]);

    const outputImageUrl = useMemo(() => {
        if (!gen) return null;

        const g: any = gen;

        const direct = g.output_image_url || g.outputImageUrl || g.result_image_url || null;
        if (direct) return String(direct);

        const preview = pickFirstImageUrl(g.preview_images);
        if (preview) return preview;

        const fromOutputFiles = pickFirstImageUrl(g.output_files);
        if (fromOutputFiles) return fromOutputFiles;

        return null;
    }, [gen]);

    const isPending = statusValue.toLowerCase().includes("pending") || statusValue.toLowerCase().includes("queue");
    const isRunning = statusValue.toLowerCase().includes("process") || statusValue.toLowerCase().includes("run");

    function openInPlayground() {
        if (!gen) return;
        router.push(`/dashboard/playground?from=${encodeURIComponent(gen.id)}`);
    }

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
            setCopied(text);
            window.setTimeout(() => setCopied(null), 900);
        } catch {
            // ignore
        }
    }

    const outputDefaultTab = outputImageUrl ? "image" : outputFiles.length ? "files" : "image";

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <Button asChild variant="ghost" className="gap-2 px-2">
                            <Link href="/dashboard/history">
                                <ArrowLeft className="h-4 w-4" />
                                Back
                            </Link>
                        </Button>

                        {loading ? (
                            <div className="h-7 w-56 rounded bg-zinc-200/70 dark:bg-white/10" />
                        ) : (
                            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
                        )}
                    </div>

                    {gen ? (
                        <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                            <StatusPill value={statusLabel} />
                            <MetaPill icon={<Palette className="h-3.5 w-3.5" />} label={styleLabel} />
                            <MetaPill
                                icon={<Calendar className="h-3.5 w-3.5" />}
                                label={createdAt ? formatDate(createdAt) : "No date"}
                            />
                            <MetaPill icon={<Hash className="h-3.5 w-3.5" />} label={gen.id} truncate />
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Copy id"
                                onClick={() => onCopy(gen.id)}
                                className="h-8 w-8"
                            >
                                <Copy className="h-4 w-4" />
                            </Button>
                            {copied === gen.id ? (
                                <span className="text-xs text-emerald-700 dark:text-emerald-300">Copied</span>
                            ) : null}
                        </div>
                    ) : null}
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="outline" className="gap-2" disabled={!gen} onClick={openInPlayground}>
                        <ExternalLink className="h-4 w-4" />
                        Open in Playground
                    </Button>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" aria-label="Open menu">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                                disabled={!gen}
                                onSelect={(e) => {
                                    e.preventDefault();
                                    openInPlayground();
                                }}
                            >
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Open in Playground
                            </DropdownMenuItem>

                            <DropdownMenuItem
                                disabled={!gen}
                                onSelect={(e) => {
                                    e.preventDefault();
                                    if (gen) onCopy(gen.id);
                                }}
                            >
                                <Copy className="mr-2 h-4 w-4" />
                                Copy id
                            </DropdownMenuItem>

                            {outputImageUrl ? (
                                <DropdownMenuItem asChild>
                                    <a href={outputImageUrl} target="_blank" rel="noreferrer">
                                        <ImageIcon className="mr-2 h-4 w-4" />
                                        Open output image
                                    </a>
                                </DropdownMenuItem>
                            ) : null}

                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                                className="text-red-600 focus:text-red-600"
                                disabled={!gen}
                                onSelect={(e) => {
                                    e.preventDefault();
                                    void onDelete();
                                }}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {error ? (
                <div className="rounded-xl border border-red-200/70 bg-red-50/60 px-3 py-2 text-sm text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
                    {error}
                </div>
            ) : null}

            <div className="grid gap-6 lg:grid-cols-12">
                <div className="lg:col-span-8">
                    <Card className="border-zinc-200/70 bg-white/70 dark:border-white/10 dark:bg-white/5">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Output</CardTitle>
                        </CardHeader>

                        <CardContent>
                            {loading ? (
                                <div className="space-y-3">
                                    <div className="h-10 w-72 rounded bg-zinc-200/70 dark:bg-white/10" />
                                    <div className="h-72 w-full rounded bg-zinc-200/70 dark:bg-white/10" />
                                </div>
                            ) : gen ? (
                                <Tabs defaultValue={outputDefaultTab}>
                                    <TabsList className="w-full justify-start">
                                        <TabsTrigger value="image">Output</TabsTrigger>
                                        <TabsTrigger value="input">Input</TabsTrigger>
                                        <TabsTrigger value="details">Details</TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="image" className="mt-4">
                                        <Card className="border-zinc-200/70 dark:border-white/10">
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-sm">Output Image</CardTitle>
                                            </CardHeader>

                                        </Card>
                                    </TabsContent>

                                    <TabsContent value="files" className="mt-4">
                                        <Card className="border-zinc-200/70 dark:border-white/10">
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-sm">Output Files</CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-2">
                                                {outputFiles.length ? (
                                                    outputFiles.map((u) => (
                                                        <div
                                                            key={u}
                                                            className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200/70 bg-white/60 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
                                                        >
                                                            <div className="min-w-0 truncate text-zinc-800 dark:text-zinc-200">{u}</div>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 shrink-0"
                                                                aria-label="Copy file url"
                                                                onClick={() => onCopy(u)}
                                                            >
                                                                <Copy className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="rounded-xl border border-zinc-200/70 bg-white/60 px-3 py-3 text-sm text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
                                                        No output files.
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    </TabsContent>

                                    <TabsContent value="input" className="mt-4">
                                        <Card className="border-zinc-200/70 dark:border-white/10">
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-sm">Input Text</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                {inputText ? (
                                                    <pre className="whitespace-pre-wrap break-words rounded-xl border border-zinc-200/70 bg-white/60 p-3 text-sm text-zinc-800 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">
                            {String(inputText)}
                          </pre>
                                                ) : (
                                                    <div className="rounded-xl border border-zinc-200/70 bg-white/60 px-3 py-3 text-sm text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
                                                        No input text stored for this generation.
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    </TabsContent>

                                    <TabsContent value="details" className="mt-4">
                                        <div className="grid gap-4 md:grid-cols-2">
                                            <Card className="border-zinc-200/70 dark:border-white/10">
                                                <CardHeader className="pb-2">
                                                    <CardTitle className="text-sm">Metadata</CardTitle>
                                                </CardHeader>
                                                <CardContent className="space-y-2 text-sm">
                                                    <Row label="Id" value={gen.id} onCopy={() => onCopy(gen.id)} />
                                                    <Row label="Title" value={(gen as any)?.title || "Untitled"} />
                                                    <Row label="Status" value={statusLabel} />
                                                    <Row label="Style" value={styleLabel} />
                                                    <Row label="Created" value={createdAt ? formatDate(createdAt) : "No date"} />
                                                </CardContent>
                                            </Card>

                                            <Card className="border-zinc-200/70 dark:border-white/10">
                                                <CardHeader className="pb-2">
                                                    <CardTitle className="text-sm">Raw JSON</CardTitle>
                                                </CardHeader>
                                                <CardContent>
                          <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-zinc-200/70 bg-white/60 p-3 text-xs text-zinc-800 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">
                            {JSON.stringify(gen, null, 2)}
                          </pre>
                                                </CardContent>
                                            </Card>
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            ) : (
                                <div className="rounded-xl border border-zinc-200/70 bg-white/60 px-3 py-3 text-sm text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
                                    Not found.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-4">
                    <Card className="border-zinc-200/70 bg-white/70 dark:border-white/10 dark:bg-white/5">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Quick Actions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <Button variant="outline" className="w-full justify-start gap-2" disabled={!gen} onClick={openInPlayground}>
                                <ExternalLink className="h-4 w-4" />
                                Open in Playground
                            </Button>

                            <Button
                                variant="outline"
                                className="w-full justify-start gap-2"
                                disabled={!gen}
                                onClick={() => gen && onCopy(gen.id)}
                            >
                                <Copy className="h-4 w-4" />
                                Copy id
                            </Button>

                            {outputImageUrl ? (
                                <Button
                                    variant="outline"
                                    className="w-full justify-start gap-2"
                                    disabled={!gen}
                                    onClick={() => onCopy(outputImageUrl)}
                                >
                                    <ImageIcon className="h-4 w-4" />
                                    Copy output image url
                                </Button>
                            ) : null}

                            <Button
                                variant="outline"
                                className="w-full justify-start gap-2 text-red-600 hover:text-red-600"
                                disabled={!gen}
                                onClick={() => void onDelete()}
                            >
                                <Trash2 className="h-4 w-4" />
                                Delete
                            </Button>

                            <div className="pt-3 text-xs text-zinc-500 dark:text-zinc-400">
                                Output is image only.
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="mt-6 border-zinc-200/70 bg-white/70 dark:border-white/10 dark:bg-white/5">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">At a glance</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                            <div className="flex items-center gap-2">
                                <Palette className="h-4 w-4" />
                                <span>Preset or custom style</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <ImageIcon className="h-4 w-4" />
                                <span>Image output</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <File className="h-4 w-4" />
                                <span>Optional file outputs</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

function MetaPill({
                      icon,
                      label,
                      truncate,
                  }: {
    icon: React.ReactNode;
    label: string;
    truncate?: boolean;
}) {
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200/70 bg-white/60 px-2.5 py-1 text-xs text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
      {icon}
            <span className={truncate ? "max-w-[320px] truncate" : ""}>{label}</span>
    </span>
    );
}

function Row({ label, value, onCopy }: { label: string; value: string; onCopy?: () => void }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <div className="text-zinc-600 dark:text-zinc-400">{label}</div>
            <div className="flex items-center gap-2">
                <div className="max-w-[380px] truncate font-medium text-zinc-900 dark:text-zinc-100">{value}</div>
                {onCopy ? (
                    <Button variant="ghost" size="icon" aria-label={`Copy ${label}`} onClick={onCopy} className="h-8 w-8">
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
    if (!gen) return "No style";
    const style = (gen as any).style;

    if (style?.mode === "custom") return "Custom";
    if (style?.mode === "preset") {
        const presetTitle = style?.snapshot_title;
        if (presetTitle) return presetTitle;
        const presetId = style?.preset_id || style?.presetId;
        if (presetId) return `Preset ${presetId}`;
        return "Preset";
    }

    return "Preset";
}

function pickFirstImageUrl(value: unknown): string | null {
    const arr = Array.isArray(value) ? value : [];
    for (const item of arr) {
        const u = typeof item === "string" ? item : null;
        if (!u) continue;

        const lower = u.toLowerCase();
        if (
            lower.includes(".png") ||
            lower.includes(".jpg") ||
            lower.includes(".jpeg") ||
            lower.includes(".webp") ||
            lower.startsWith("data:image/")
        ) {
            return u;
        }
    }
    return null;
}

function StatusPill({ value }: { value: string }) {
    const v = value.toLowerCase();

    const cls =
        v.includes("succeed") || v === "done" || v === "success"
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