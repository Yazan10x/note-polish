// src/app/dashboard/history/[id]/page.tsx
"use client";

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
    Download,
} from "lucide-react";

import type { PublicNoteGeneration } from "@/lib/models/noteGeneration";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type UrlKind = "image" | "pdf" | "other" | "unknown";

export default function HistoryResultPage() {
    const router = useRouter();
    const params = useParams<{ id: string }>();

    const id = useMemo(() => {
        const rawId = params?.id ?? "";
        const m = String(rawId).match(/[a-f0-9]{24}/i);
        return (m?.[0] ?? rawId).trim();
    }, [params?.id]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [gen, setGen] = useState<PublicNoteGeneration | null>(null);
    const [copied, setCopied] = useState<string | null>(null);
    const [downloading, setDownloading] = useState(false);

    // Input preview detection (works with extensionless /files/:id)
    const [inputPreviewUrl, setInputPreviewUrl] = useState<string | null>(null);
    const [inputPreviewKind, setInputPreviewKind] = useState<UrlKind>("unknown");

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
                if (!cancelled) setGen(data);
            } catch (e) {
                if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load generation");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        void load();
        return () => {
            cancelled = true;
        };
    }, [id]);

    const title = useMemo(() => getStr(gen as any, "title") || "Generation", [gen]);
    const createdAt = useMemo(
        () => getStr(gen as any, "created_at") || getStr(gen as any, "createdAt") || null,
        [gen]
    );

    const statusValue = useMemo(() => String((gen as any)?.status || "unknown").trim() || "unknown", [gen]);
    const statusLabel = useMemo(() => statusValue.replaceAll("_", " ").trim() || "unknown", [statusValue]);
    const styleLabel = useMemo(() => formatStyle(gen), [gen]);

    const inputText = useMemo(() => getStr(gen as any, "input_text") || getStr(gen as any, "inputText") || null, [gen]);

    const inputFiles = useMemo(() => {
        const files = (gen as any)?.input_files;
        return Array.isArray(files) ? (files as string[]) : [];
    }, [gen]);

    const outputFiles = useMemo(() => {
        const files = (gen as any)?.output_files;
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
    const isBusy = loading || downloading;

    // Resolve input preview kind/url
    useEffect(() => {
        let cancelled = false;

        async function resolveInputPreview() {
            if (!inputFiles.length) {
                setInputPreviewUrl(null);
                setInputPreviewKind("unknown");
                return;
            }

            // Fast path by extension / data URL
            const extImg = pickFirstImageUrl(inputFiles);
            if (extImg) {
                setInputPreviewUrl(extImg);
                setInputPreviewKind("image");
                return;
            }

            const extPdf = pickFirstPdfUrl(inputFiles);
            if (extPdf) {
                setInputPreviewUrl(extPdf);
                setInputPreviewKind("pdf");
                return;
            }

            // Slow path by HEAD content-type (for /files/:id)
            const first = inputFiles[0] ?? null;
            if (!first) {
                setInputPreviewUrl(null);
                setInputPreviewKind("unknown");
                return;
            }

            setInputPreviewUrl(first);
            setInputPreviewKind("unknown");

            const kind = await detectUrlKind(first);
            if (!cancelled) setInputPreviewKind(kind);
        }

        void resolveInputPreview();
        return () => {
            cancelled = true;
        };
    }, [inputFiles]);

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

    async function downloadFromUrl(url: string, suggestedName?: string) {
        setError(null);
        const name = suggestedName?.trim() || filenameFromUrl(url) || "download";

        setDownloading(true);
        try {
            const res = await fetch(url, { method: "GET" });
            if (!res.ok) throw new Error("Download failed");

            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = name;
            document.body.appendChild(a);
            a.click();
            a.remove();

            URL.revokeObjectURL(blobUrl);
        } catch {
            window.open(url, "_blank", "noopener,noreferrer");
        } finally {
            setDownloading(false);
        }
    }

    const suggestedOutputName = useMemo(() => {
        const base = String(title || "output").trim().slice(0, 80) || "output";
        const safe = base.replace(/[\\/:*?"<>|]+/g, "_").trim() || "output";
        const ext = outputImageUrl ? guessImageExt(outputImageUrl) : "";
        return ext ? `${safe}.${ext}` : `${safe}.png`;
    }, [title, outputImageUrl]);

    const canShowInputPreview = Boolean(inputPreviewUrl) && (inputPreviewKind === "image" || inputPreviewKind === "pdf");

    return (
        <div className="space-y-6">
            <HeaderBar
                loading={loading}
                gen={gen}
                title={title}
                statusLabel={statusLabel}
                styleLabel={styleLabel}
                createdAt={createdAt}
                copied={copied}
                onCopy={onCopy}
                onOpenPlayground={openInPlayground}
                onDelete={onDelete}
                outputImageUrl={outputImageUrl}
                isBusy={isBusy}
                onDownloadOutput={() => outputImageUrl && downloadFromUrl(outputImageUrl, suggestedOutputName)}
            />

            {error ? (
                <div className="rounded-xl border border-red-200/70 bg-red-50/60 px-3 py-2 text-sm text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
                    {error}
                </div>
            ) : null}

            <div className="grid gap-6 lg:grid-cols-12">
                <div className="lg:col-span-8 space-y-6">
                    <SectionCard title="Output preview">
                        {loading ? (
                            <Skeleton block />
                        ) : gen ? (
                            <div className="space-y-4">
                                {outputImageUrl ? (
                                    <>
                                        <ImagePreview
                                            url={outputImageUrl}
                                            alt="Output"
                                            // Use plain <img> so cookies are sent to /files/:id routes (Next image optimizer breaks this)
                                        />
                                        <div className="flex flex-wrap gap-2">
                                            <Button variant="outline" className="gap-2" asChild disabled={isBusy}>
                                                <a href={outputImageUrl} target="_blank" rel="noreferrer">
                                                    <ExternalLink className="h-4 w-4" />
                                                    Open
                                                </a>
                                            </Button>

                                            <Button
                                                variant="outline"
                                                className="gap-2"
                                                disabled={isBusy}
                                                onClick={() => onCopy(outputImageUrl)}
                                            >
                                                <Copy className="h-4 w-4" />
                                                Copy url
                                            </Button>

                                            <Button
                                                variant="outline"
                                                className="gap-2"
                                                disabled={isBusy}
                                                onClick={() => void downloadFromUrl(outputImageUrl, suggestedOutputName)}
                                            >
                                                <Download className="h-4 w-4" />
                                                {downloading ? "Downloading..." : "Download"}
                                            </Button>

                                            {copied === outputImageUrl ? (
                                                <span className="self-center text-xs text-emerald-700 dark:text-emerald-300">
                                                    Copied
                                                </span>
                                            ) : null}
                                        </div>
                                    </>
                                ) : (
                                    <EmptyBox>
                                        {isPending || isRunning
                                            ? "This generation is not finished yet."
                                            : "No output image found for this generation."}
                                    </EmptyBox>
                                )}

                                {outputFiles.length ? (
                                    <FileList
                                        title="Output files"
                                        files={outputFiles}
                                        onCopy={onCopy}
                                    />
                                ) : null}
                            </div>
                        ) : (
                            <EmptyBox>Not found.</EmptyBox>
                        )}
                    </SectionCard>

                    <SectionCard title="Input preview">
                        {loading ? (
                            <Skeleton />
                        ) : gen ? (
                            <div className="space-y-4">
                                {canShowInputPreview && inputPreviewUrl ? (
                                    <div className="rounded-xl border border-zinc-200/70 bg-white/60 p-3 dark:border-white/10 dark:bg-white/5">
                                        {inputPreviewKind === "image" ? (
                                            <ImagePreview url={inputPreviewUrl} alt="Input preview" />
                                        ) : inputPreviewKind === "pdf" ? (
                                            <div className="overflow-hidden rounded-xl border border-zinc-200/70 bg-white/60 dark:border-white/10 dark:bg-white/5">
                                                <iframe title="Input PDF preview" src={inputPreviewUrl} className="h-[520px] w-full" />
                                            </div>
                                        ) : null}

                                        <div className="mt-3 flex flex-wrap gap-2">
                                            <Button variant="outline" className="gap-2" asChild disabled={isBusy}>
                                                <a href={inputPreviewUrl} target="_blank" rel="noreferrer">
                                                    <ExternalLink className="h-4 w-4" />
                                                    Open preview
                                                </a>
                                            </Button>

                                            <Button
                                                variant="outline"
                                                className="gap-2"
                                                disabled={isBusy}
                                                onClick={() => onCopy(inputPreviewUrl)}
                                            >
                                                <Copy className="h-4 w-4" />
                                                Copy url
                                            </Button>

                                            {copied === inputPreviewUrl ? (
                                                <span className="self-center text-xs text-emerald-700 dark:text-emerald-300">
                                                    Copied
                                                </span>
                                            ) : null}
                                        </div>
                                    </div>
                                ) : (
                                    <EmptyBox>No input file preview available.</EmptyBox>
                                )}

                                <FileList title="Input files" files={inputFiles} onCopy={onCopy} />

                                <Card className="border-zinc-200/70 dark:border-white/10">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm">Input text</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        {inputText ? (
                                            <pre className="whitespace-pre-wrap break-words rounded-xl border border-zinc-200/70 bg-white/60 p-3 text-sm text-zinc-800 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">
                                                {String(inputText)}
                                            </pre>
                                        ) : (
                                            <EmptyBox>No input text stored for this generation.</EmptyBox>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        ) : (
                            <EmptyBox>Not found.</EmptyBox>
                        )}
                    </SectionCard>

                    {gen ? (
                        <div className="grid gap-4 md:grid-cols-2">
                            <Card className="border-zinc-200/70 bg-white/70 dark:border-white/10 dark:bg-white/5">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Details</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                    <Row label="Id" value={gen.id} onCopy={() => onCopy(gen.id)} />
                                    <Row label="Title" value={(gen as any)?.title || "Untitled"} />
                                    <Row label="Status" value={statusLabel} />
                                    <Row label="Style" value={styleLabel} />
                                    <Row label="Created" value={createdAt ? formatDate(createdAt) : "No date"} />
                                </CardContent>
                            </Card>

                            <Card className="border-zinc-200/70 bg-white/70 dark:border-white/10 dark:bg-white/5">
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
                    ) : null}
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
                                <>
                                    <Button
                                        variant="outline"
                                        className="w-full justify-start gap-2"
                                        disabled={!gen || isBusy}
                                        onClick={() => onCopy(outputImageUrl)}
                                    >
                                        <ImageIcon className="h-4 w-4" />
                                        Copy output url
                                    </Button>

                                    <Button
                                        variant="outline"
                                        className="w-full justify-start gap-2"
                                        disabled={!gen || isBusy}
                                        onClick={() => void downloadFromUrl(outputImageUrl, suggestedOutputName)}
                                    >
                                        <Download className="h-4 w-4" />
                                        {downloading ? "Downloading..." : "Download output"}
                                    </Button>
                                </>
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
                                <span>Output image when ready</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <File className="h-4 w-4" />
                                <span>Input files supported</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

function HeaderBar(props: {
    loading: boolean;
    gen: PublicNoteGeneration | null;
    title: string;
    statusLabel: string;
    styleLabel: string;
    createdAt: string | null;
    copied: string | null;
    onCopy: (t: string) => void;
    onOpenPlayground: () => void;
    onDelete: () => void;
    outputImageUrl: string | null;
    isBusy: boolean;
    onDownloadOutput: () => void;
}) {
    const {
        loading,
        gen,
        title,
        statusLabel,
        styleLabel,
        createdAt,
        copied,
        onCopy,
        onOpenPlayground,
        onDelete,
        outputImageUrl,
        isBusy,
        onDownloadOutput,
    } = props;

    return (
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
                <Button variant="outline" className="gap-2" disabled={!gen} onClick={onOpenPlayground}>
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
                                onOpenPlayground();
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
                            <>
                                <DropdownMenuItem asChild>
                                    <a href={outputImageUrl} target="_blank" rel="noreferrer">
                                        <ImageIcon className="mr-2 h-4 w-4" />
                                        Open output image
                                    </a>
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                    disabled={isBusy}
                                    onSelect={(e) => {
                                        e.preventDefault();
                                        onDownloadOutput();
                                    }}
                                >
                                    <Download className="mr-2 h-4 w-4" />
                                    Download output
                                </DropdownMenuItem>
                            </>
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
    );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <Card className="border-zinc-200/70 bg-white/70 dark:border-white/10 dark:bg-white/5">
            <CardHeader className="pb-3">
                <CardTitle className="text-base">{title}</CardTitle>
            </CardHeader>
            <CardContent>{children}</CardContent>
        </Card>
    );
}

function ImagePreview({ url, alt }: { url: string; alt: string }) {
    // IMPORTANT: use plain <img> to avoid Next image optimizer (/_next/image) failing on authed /files/:id routes.
    return (
        <div className="relative overflow-hidden rounded-xl border border-zinc-200/70 bg-white/60 dark:border-white/10 dark:bg-white/5">
            <div className="relative aspect-[4/3] w-full">
                <img
                    src={url}
                    alt={alt}
                    className="absolute inset-0 h-full w-full object-contain"
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                />
            </div>
        </div>
    );
}

function FileList({
                      title,
                      files,
                      onCopy,
                  }: {
    title: string;
    files: string[];
    onCopy: (u: string) => void;
}) {
    return (
        <Card className="border-zinc-200/70 dark:border-white/10">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm">{title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
                {files.length ? (
                    files.map((u) => (
                        <div
                            key={u}
                            className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200/70 bg-white/60 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
                        >
                            <div className="flex min-w-0 items-center gap-2">
                                <File className="h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
                                <div className="min-w-0">
                                    <div className="truncate text-zinc-800 dark:text-zinc-200">{fileLabelFromUrl(u)}</div>
                                    <div className="truncate text-[11px] text-zinc-600 dark:text-zinc-400">{u}</div>
                                </div>
                            </div>

                            <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" asChild aria-label="Open file">
                                    <a href={u} target="_blank" rel="noreferrer">
                                        <ExternalLink className="h-4 w-4" />
                                    </a>
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    aria-label="Copy file url"
                                    onClick={() => onCopy(u)}
                                >
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))
                ) : (
                    <EmptyBox>No files.</EmptyBox>
                )}
            </CardContent>
        </Card>
    );
}

function Skeleton({ block }: { block?: boolean }) {
    return (
        <div className="space-y-3">
            <div className="h-10 w-72 rounded bg-zinc-200/70 dark:bg-white/10" />
            <div className={block ? "h-72 w-full rounded bg-zinc-200/70 dark:bg-white/10" : "h-56 w-full rounded bg-zinc-200/70 dark:bg-white/10"} />
        </div>
    );
}

function EmptyBox({ children }: { children: React.ReactNode }) {
    return (
        <div className="rounded-xl border border-zinc-200/70 bg-white/60 px-3 py-3 text-sm text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
            {children}
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

    return <span className={["inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", cls].join(" ")}>{value}</span>;
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

function pickFirstPdfUrl(value: unknown): string | null {
    const arr = Array.isArray(value) ? value : [];
    for (const item of arr) {
        const u = typeof item === "string" ? item : null;
        if (!u) continue;

        const lower = u.toLowerCase();
        if (lower.includes(".pdf") || lower.startsWith("data:application/pdf")) return u;
    }
    return null;
}

async function detectUrlKind(url: string): Promise<UrlKind> {
    try {
        const res = await fetch(url, { method: "HEAD", cache: "no-store" });
        const ct = (res.headers.get("content-type") || "").toLowerCase();
        if (ct.startsWith("image/")) return "image";
        if (ct.includes("application/pdf")) return "pdf";
        return "other";
    } catch {
        return "unknown";
    }
}

function fileLabelFromUrl(url: string): string {
    try {
        const u = new URL(url, typeof window !== "undefined" ? window.location.origin : "http://localhost");
        const last = (u.pathname || "").split("/").filter(Boolean).pop() || "file";
        return decodeURIComponent(last);
    } catch {
        const cleaned = url.split("?")[0] || "";
        const last = cleaned.split("/").filter(Boolean).pop() || "file";
        return last;
    }
}

function filenameFromUrl(url: string): string {
    try {
        const u = new URL(url, typeof window !== "undefined" ? window.location.origin : "http://localhost");
        const last = (u.pathname || "").split("/").filter(Boolean).pop() || "download";
        return decodeURIComponent(last);
    } catch {
        const cleaned = url.split("?")[0] || "";
        return cleaned.split("/").filter(Boolean).pop() || "download";
    }
}

function guessImageExt(url: string): string {
    const u = url.toLowerCase();
    if (u.includes(".webp")) return "webp";
    if (u.includes(".png")) return "png";
    if (u.includes(".jpeg")) return "jpeg";
    if (u.includes(".jpg")) return "jpg";
    return "png";
}

function getStr(obj: any, key: string): string | null {
    const v = obj?.[key];
    return typeof v === "string" ? v : null;
}

async function safeJson(res: Response) {
    try {
        return await res.json();
    } catch {
        return null;
    }
}