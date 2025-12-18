// src/app/dashboard/history/[id]/page.tsx
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
    Loader2,
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
    const id = useMemo(() => normalizeId(params?.id), [params?.id]);

    const [error, setError] = useState<string | null>(null);
    const { copied, copy } = useCopyToast();
    const { downloading, downloadFromUrl } = useDownloader(setError);

    const { gen, loading, refresh } = useGeneration(id, setError);

    const statusValue = String((gen as any)?.status || "unknown").trim() || "unknown";
    const statusTokens = tokenizeStatus(statusValue);

    // Poll only for these exact tokens (so "processed" will NOT poll)
    const shouldPoll = hasAnyToken(statusTokens, ["queued", "queue", "pending", "processing", "running"]);
    const isPending = hasAnyToken(statusTokens, ["queued", "queue", "pending"]);
    const isRunning = hasAnyToken(statusTokens, ["processing", "running"]);

    const polling = usePollingRefresh({
        enabled: Boolean(id) && shouldPoll,
        intervalMs: 2000,
        refresh,
    });

    const isBusy = loading || downloading;

    const title = getFirstString(gen as any, ["title"]) || "Generation";
    const createdAt = getFirstString(gen as any, ["created_at", "createdAt"]);
    const statusLabel = statusValue.replaceAll("_", " ").trim() || "unknown";
    const styleLabel = formatStyle(gen);

    const inputText = getFirstString(gen as any, ["input_text", "inputText"]);

    // IMPORTANT: memoize these arrays so hooks depending on them do not re-run every render
    const inputFiles = useMemo(() => getStringArray((gen as any)?.input_files), [gen]);
    const outputFiles = useMemo(() => getStringArray((gen as any)?.output_files), [gen]);
    const previewImages = useMemo(() => getStringArray((gen as any)?.preview_images), [gen]);

    // Input preview: works for extensionless /files/:id via HEAD
    const inputPreview = useBestPreview(inputFiles);

    // Output preview: build candidates + choose best (supports extensionless)
    const outputCandidates = useMemo(() => {
        if (!gen) return [];
        const g: any = gen;

        const out: string[] = [];
        const direct = getFirstString(g, ["output_image_url", "outputImageUrl", "result_image_url"]);
        if (direct) out.push(direct);

        for (const u of previewImages) out.push(u);
        for (const u of outputFiles) out.push(u);

        return uniqueStrings(out);
    }, [gen, previewImages, outputFiles]);

    const outputPreview = useBestPreview(outputCandidates);

    const canShowInputPreview = Boolean(inputPreview.url) && (inputPreview.kind === "image" || inputPreview.kind === "pdf");
    const canShowOutputPreview =
        Boolean(outputPreview.url) && (outputPreview.kind === "image" || outputPreview.kind === "pdf");

    const suggestedOutputName = useMemo(() => {
        const base = String(title || "output").trim().slice(0, 80) || "output";
        const safe = base.replace(/[\\/:*?"<>|]+/g, "_").trim() || "output";

        if (!outputPreview.url) return `${safe}.png`;
        if (outputPreview.kind === "pdf") return `${safe}.pdf`;
        return `${safe}.${guessImageExt(outputPreview.url)}`;
    }, [title, outputPreview.url, outputPreview.kind]);

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

    return (
        <div className="space-y-6">
            <HeaderBar
                loading={loading}
                polling={polling}
                gen={gen}
                title={title}
                statusLabel={statusLabel}
                styleLabel={styleLabel}
                createdAt={createdAt}
                copied={copied}
                onCopy={copy}
                onOpenPlayground={openInPlayground}
                onDelete={onDelete}
                outputPreviewUrl={outputPreview.url}
                isBusy={isBusy}
                onDownloadOutput={() => outputPreview.url && downloadFromUrl(outputPreview.url, suggestedOutputName)}
            />

            {shouldPoll ? (
                <ProcessingBanner
                    message={
                        isPending
                            ? "Queued. Refreshing every 2 seconds."
                            : isRunning
                                ? "Processing. Refreshing every 2 seconds."
                                : "Refreshing every 2 seconds."
                    }
                />
            ) : null}

            {error ? (
                <div className="rounded-xl border border-red-200/70 bg-red-50/60 px-3 py-2 text-sm text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
                    {error}
                </div>
            ) : null}

            <div className="grid gap-6 lg:grid-cols-12">
                <div className="space-y-6 lg:col-span-8">
                    <SectionCard title="Output preview">
                        {loading ? (
                            <Skeleton block />
                        ) : gen ? (
                            <div className="space-y-4">
                                {canShowOutputPreview && outputPreview.url ? (
                                    <>
                                        {outputPreview.kind === "image" ? (
                                            <ImagePreview url={outputPreview.url} alt="Output" />
                                        ) : (
                                            <div className="overflow-hidden rounded-xl border border-zinc-200/70 bg-white/60 dark:border-white/10 dark:bg-white/5">
                                                <iframe title="Output PDF preview" src={outputPreview.url} className="h-[520px] w-full" />
                                            </div>
                                        )}

                                        <UrlActions
                                            url={outputPreview.url}
                                            copied={copied}
                                            isBusy={isBusy}
                                            onCopy={copy}
                                            onDownload={() => downloadFromUrl(outputPreview.url!, suggestedOutputName)}
                                            downloadLabel={downloading ? "Downloading..." : "Download"}
                                            showDownload
                                        />
                                    </>
                                ) : (
                                    <EmptyBox>
                                        {shouldPoll
                                            ? "This generation is not finished yet."
                                            : outputFiles.length
                                                ? "Output preview unavailable. See output files below."
                                                : "No output file found for this generation."}
                                    </EmptyBox>
                                )}

                                {outputFiles.length ? <FileList title="Output files" files={outputFiles} onCopy={copy} /> : null}
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
                                {canShowInputPreview && inputPreview.url ? (
                                    <div className="rounded-xl border border-zinc-200/70 bg-white/60 p-3 dark:border-white/10 dark:bg-white/5">
                                        {inputPreview.kind === "image" ? (
                                            <ImagePreview url={inputPreview.url} alt="Input preview" />
                                        ) : (
                                            <div className="overflow-hidden rounded-xl border border-zinc-200/70 bg-white/60 dark:border-white/10 dark:bg-white/5">
                                                <iframe title="Input PDF preview" src={inputPreview.url} className="h-[520px] w-full" />
                                            </div>
                                        )}

                                        <div className="mt-3">
                                            <UrlActions url={inputPreview.url} copied={copied} isBusy={isBusy} onCopy={copy} />
                                        </div>
                                    </div>
                                ) : (
                                    <EmptyBox>No input file preview available.</EmptyBox>
                                )}

                                <FileList title="Input files" files={inputFiles} onCopy={copy} />

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
                                    <Row label="Id" value={gen.id} onCopy={() => copy(gen.id)} />
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
                            <Button
                                variant="outline"
                                className="w-full justify-start gap-2"
                                disabled={!gen}
                                onClick={openInPlayground}
                            >
                                <ExternalLink className="h-4 w-4" />
                                Open in Playground
                            </Button>

                            <Button
                                variant="outline"
                                className="w-full justify-start gap-2"
                                disabled={!gen}
                                onClick={() => gen && copy(gen.id)}
                            >
                                <Copy className="h-4 w-4" />
                                Copy id
                            </Button>

                            {outputPreview.url ? (
                                <>
                                    <Button
                                        variant="outline"
                                        className="w-full justify-start gap-2"
                                        disabled={!gen || isBusy}
                                        onClick={() => copy(outputPreview.url!)}
                                    >
                                        <ImageIcon className="h-4 w-4" />
                                        Copy output url
                                    </Button>

                                    <Button
                                        variant="outline"
                                        className="w-full justify-start gap-2"
                                        disabled={!gen || isBusy}
                                        onClick={() => downloadFromUrl(outputPreview.url!, suggestedOutputName)}
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
                                <span>Output preview when ready</span>
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

/* -------------------------------- Hooks -------------------------------- */

function useGeneration(id: string, setError: (v: string | null) => void) {
    const [gen, setGen] = useState<PublicNoteGeneration | null>(null);
    const [loading, setLoading] = useState(true);

    const refreshInFlight = useRef(false);

    const refresh = useCallback(async (): Promise<PublicNoteGeneration | null> => {
        if (!id) return null;
        if (refreshInFlight.current) return null;

        refreshInFlight.current = true;
        try {
            const data = await fetchGeneration(id);
            setGen(data);
            return data;
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to refresh generation");
            return null;
        } finally {
            refreshInFlight.current = false;
        }
    }, [id, setError]);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            if (!id) return;
            setLoading(true);
            setError(null);

            try {
                const data = await fetchGeneration(id);
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
    }, [id, setError]);

    return { gen, loading, refresh };
}

function usePollingRefresh(opts: { enabled: boolean; intervalMs: number; refresh: () => Promise<unknown> }) {
    const { enabled, intervalMs, refresh } = opts;

    const [polling, setPolling] = useState(false);

    const refreshRef = useRef(refresh);
    const timeoutRef = useRef<number | null>(null);
    const activeRef = useRef(false);

    useEffect(() => {
        refreshRef.current = refresh;
    }, [refresh]);

    useEffect(() => {
        activeRef.current = enabled;

        async function tick() {
            if (!activeRef.current) return;

            try {
                await refreshRef.current();
            } catch {
                // refresh handles errors
            } finally {
                if (!activeRef.current) return;
                timeoutRef.current = window.setTimeout(() => void tick(), intervalMs);
            }
        }

        if (enabled) {
            setPolling(true);
            if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
            timeoutRef.current = window.setTimeout(() => void tick(), intervalMs);
        } else {
            setPolling(false);
            if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }

        return () => {
            activeRef.current = false;
            setPolling(false);
            if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        };
    }, [enabled, intervalMs]);

    return polling;
}

function useCopyToast() {
    const [copied, setCopied] = useState<string | null>(null);

    function copy(text: string) {
        const t = String(text || "");
        if (!t) return;

        try {
            navigator.clipboard?.writeText(t);
            setCopied(t);
            window.setTimeout(() => setCopied(null), 900);
        } catch {
            // ignore
        }
    }

    return { copied, copy };
}

function useDownloader(setError: (v: string | null) => void) {
    const [downloading, setDownloading] = useState(false);

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

    return { downloading, downloadFromUrl };
}

function useBestPreview(urls: string[]) {
    const [url, setUrl] = useState<string | null>(null);
    const [kind, setKind] = useState<UrlKind>("unknown");

    // CRITICAL FIX: depend on contents, not array identity, to avoid re-running every render
    const urlsKey = useMemo(() => uniqueStrings(urls).join("\n"), [urls]);

    useEffect(() => {
        let cancelled = false;

        async function resolve() {
            const list = uniqueStrings(urls);
            if (!list.length) {
                setUrl(null);
                setKind("unknown");
                return;
            }

            const fastImage = list.find(isImageLike);
            if (fastImage) {
                setUrl(fastImage);
                setKind("image");
                return;
            }

            const fastPdf = list.find(isPdfLike);
            if (fastPdf) {
                setUrl(fastPdf);
                setKind("pdf");
                return;
            }

            for (const candidate of list) {
                setUrl(candidate);
                setKind("unknown");

                const detected = await detectUrlKind(candidate);
                if (cancelled) return;

                if (detected === "image" || detected === "pdf") {
                    setUrl(candidate);
                    setKind(detected);
                    return;
                }
            }

            setUrl(list[0] || null);
            setKind("other");
        }

        void resolve();
        return () => {
            cancelled = true;
        };
    }, [urlsKey]); // only rerun when list content changes

    return { url, kind };
}

/* ------------------------------ Components ------------------------------ */

function HeaderBar(props: {
    loading: boolean;
    polling: boolean;
    gen: PublicNoteGeneration | null;
    title: string;
    statusLabel: string;
    styleLabel: string;
    createdAt: string | null;
    copied: string | null;
    onCopy: (t: string) => void;
    onOpenPlayground: () => void;
    onDelete: () => void;
    outputPreviewUrl: string | null;
    isBusy: boolean;
    onDownloadOutput: () => void;
}) {
    const {
        loading,
        polling,
        gen,
        title,
        statusLabel,
        styleLabel,
        createdAt,
        copied,
        onCopy,
        onOpenPlayground,
        onDelete,
        outputPreviewUrl,
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

                        {polling ? (
                            <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200/70 bg-white/60 px-2.5 py-1 text-xs text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Refreshing
                            </span>
                        ) : null}

                        <MetaPill icon={<Palette className="h-3.5 w-3.5" />} label={styleLabel} />
                        <MetaPill icon={<Calendar className="h-3.5 w-3.5" />} label={createdAt ? formatDate(createdAt) : "No date"} />
                        <MetaPill icon={<Hash className="h-3.5 w-3.5" />} label={gen.id} truncate />

                        <Button variant="ghost" size="icon" aria-label="Copy id" onClick={() => onCopy(gen.id)} className="h-8 w-8">
                            <Copy className="h-4 w-4" />
                        </Button>
                        {copied === gen.id ? <span className="text-xs text-emerald-700 dark:text-emerald-300">Copied</span> : null}
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

                        {outputPreviewUrl ? (
                            <>
                                <DropdownMenuItem asChild>
                                    <a href={outputPreviewUrl} target="_blank" rel="noreferrer">
                                        <ImageIcon className="mr-2 h-4 w-4" />
                                        Open output
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

function ProcessingBanner({ message }: { message: string }) {
    return (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200/70 bg-white/60 px-3 py-2 text-sm text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
            <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500/60 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-500" />
                </span>
                <span>{message}</span>
            </div>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Auto refresh</span>
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

function UrlActions(props: {
    url: string;
    copied: string | null;
    isBusy: boolean;
    onCopy: (t: string) => void;
    onDownload?: () => void;
    showDownload?: boolean;
    downloadLabel?: string;
}) {
    const { url, copied, isBusy, onCopy, onDownload, showDownload, downloadLabel } = props;

    return (
        <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2" asChild disabled={isBusy}>
                <a href={url} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Open
                </a>
            </Button>

            <Button variant="outline" className="gap-2" disabled={isBusy} onClick={() => onCopy(url)}>
                <Copy className="h-4 w-4" />
                Copy url
            </Button>

            {showDownload ? (
                <Button variant="outline" className="gap-2" disabled={isBusy} onClick={() => onDownload?.()}>
                    <Download className="h-4 w-4" />
                    {downloadLabel || "Download"}
                </Button>
            ) : null}

            {copied === url ? <span className="self-center text-xs text-emerald-700 dark:text-emerald-300">Copied</span> : null}
        </div>
    );
}

function ImagePreview({ url, alt }: { url: string; alt: string }) {
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

function FileList({ title, files, onCopy }: { title: string; files: string[]; onCopy: (u: string) => void }) {
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

function MetaPill({ icon, label, truncate }: { icon: React.ReactNode; label: string; truncate?: boolean }) {
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
                : v.includes("processing") || v.includes("running")
                    ? "bg-blue-500/10 text-blue-700 dark:text-blue-300"
                    : v.includes("queue") || v.includes("pending")
                        ? "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300"
                        : "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300";

    return <span className={["inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", cls].join(" ")}>{value}</span>;
}

/* -------------------------------- Utils -------------------------------- */

function tokenizeStatus(v: string): string[] {
    return String(v || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .split(" ")
        .filter(Boolean);
}

function hasAnyToken(tokens: string[], anyOf: string[]): boolean {
    const set = new Set(tokens);
    return anyOf.some((t) => set.has(t));
}

async function fetchGeneration(id: string): Promise<PublicNoteGeneration> {
    const res = await fetch(`/api/generations/${encodeURIComponent(id)}`, {
        method: "GET",
        cache: "no-store",
    });
    if (!res.ok) {
        const data = await safeJson(res);
        throw new Error(data?.error || "Failed to load generation");
    }
    return (await res.json()) as PublicNoteGeneration;
}

function normalizeId(raw: unknown): string {
    const v = String(raw ?? "").trim();
    const m = v.match(/[a-f0-9]{24}/i);
    return (m?.[0] ?? v).trim();
}

function uniqueStrings(arr: string[]) {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const v of arr) {
        const s = String(v || "").trim();
        if (!s) continue;
        if (seen.has(s)) continue;
        seen.add(s);
        out.push(s);
    }
    return out;
}

function getFirstString(obj: any, keys: string[]): string | null {
    for (const k of keys) {
        const v = obj?.[k];
        if (typeof v === "string" && v.trim()) return v;
    }
    return null;
}

function getStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((x) => typeof x === "string") : [];
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

function isImageLike(u: string) {
    const lower = u.toLowerCase();
    return lower.includes(".png") || lower.includes(".jpg") || lower.includes(".jpeg") || lower.includes(".webp") || lower.startsWith("data:image/");
}

function isPdfLike(u: string) {
    const lower = u.toLowerCase();
    return lower.includes(".pdf") || lower.startsWith("data:application/pdf");
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

async function safeJson(res: Response) {
    try {
        return await res.json();
    } catch {
        return null;
    }
}