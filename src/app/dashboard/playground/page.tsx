// src/app/dashboard/playground/page.tsx
"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ExternalLink } from "lucide-react";

import type { PublicNoteGeneration, PublicStylePreset } from "@/lib/models/noteGeneration";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type StyleMode = "preset" | "custom";

type UpdatePendingPayload = {
    title?: string;
    input_text?: string;
    style: { mode: "preset"; preset_id: string } | { mode: "custom"; custom_prompt: string };
};

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB per file
const MAX_FILES = 3;

function deriveTitleFromText(text: string): string {
    const t = text?.trim() ?? "";
    if (!t) return "";
    const firstLine = t.split(/\r?\n/)[0]?.trim() ?? "";
    return firstLine.slice(0, 80);
}

function isAllowedUploadType(file: File): boolean {
    if (!file?.type) return false;
    if (file.type === "application/pdf") return true;
    if (file.type.startsWith("image/")) return true;
    return false;
}

function fileLabelFromUrl(url: string): string {
    try {
        const u = new URL(url, window.location.origin);
        const path = u.pathname || "";
        const last = path.split("/").filter(Boolean).pop() || "file";
        return decodeURIComponent(last);
    } catch {
        const cleaned = url.split("?")[0] || "";
        const last = cleaned.split("/").filter(Boolean).pop() || "file";
        return last;
    }
}

export default function PlaygroundPage() {
    const router = useRouter();

    const [title, setTitle] = useState("");
    const [inputText, setInputText] = useState("");

    const [styleMode, setStyleMode] = useState<StyleMode>("preset");

    const [presets, setPresets] = useState<PublicStylePreset[]>([]);
    const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
    const [customPrompt, setCustomPrompt] = useState("");

    const [generation, setGeneration] = useState<PublicNoteGeneration | null>(null);

    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const [isBootLoading, setIsBootLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isDeletingFile, setIsDeletingFile] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [didUpdateFlash, setDidUpdateFlash] = useState(false);

    const saveTimerRef = useRef<number | null>(null);
    const lastSavedSignatureRef = useRef<string>("");
    const updateFlashTimerRef = useRef<number | null>(null);

    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Title behaviour: auto from first line of inputText until user edits title manually.
    const isTitleManualRef = useRef(false);

    const selectedPreset = useMemo(() => {
        if (!selectedPresetId) return null;
        return presets.find((p) => p.id === selectedPresetId) ?? null;
    }, [presets, selectedPresetId]);

    function flashUpdated() {
        if (updateFlashTimerRef.current) window.clearTimeout(updateFlashTimerRef.current);
        setDidUpdateFlash(true);
        updateFlashTimerRef.current = window.setTimeout(() => setDidUpdateFlash(false), 1400);
    }

    async function refreshGeneration(id: string): Promise<PublicNoteGeneration> {
        const res = await fetch(`/api/generations/${id}`, { method: "GET", cache: "no-store" });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data?.error ?? "Failed to refresh generation");
        }
        const gen = (await res.json()) as PublicNoteGeneration;
        if (gen?.id) setGeneration(gen);
        return gen;
    }

    // 1) Load presets
    useEffect(() => {
        let cancelled = false;

        async function loadPresets() {
            const res = await fetch("/api/style-presets", { method: "GET", cache: "no-store" });
            if (!res.ok) throw new Error("Failed");

            const data = (await res.json()) as { presets: PublicStylePreset[] };
            if (cancelled) return;

            const sorted = [...(data.presets ?? [])].sort((a, b) => a.sort_order - b.sort_order);
            if (!sorted.length) throw new Error("No presets");

            setPresets(sorted);
        }

        void loadPresets();
        return () => {
            cancelled = true;
        };
    }, []);

    // 2) Get or create pending generation
    useEffect(() => {
        let cancelled = false;

        async function loadPending() {
            setError(null);
            setNotice(null);

            try {
                const res = await fetch("/api/generations/pending", { method: "POST", cache: "no-store" });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data?.error ?? "Failed to load pending generation");
                }

                const data = (await res.json()) as { generation?: PublicNoteGeneration } | PublicNoteGeneration;
                const gen = "id" in (data as any) ? (data as PublicNoteGeneration) : (data as any).generation;

                if (!gen || !gen.id) throw new Error("Invalid pending generation response");
                if (cancelled) return;

                setGeneration(gen);

                const draftText = gen.input_text ?? "";
                setInputText(draftText);

                const serverTitle = (gen as any)?.title;
                if (typeof serverTitle === "string") {
                    setTitle(serverTitle);
                    isTitleManualRef.current = Boolean(serverTitle.trim());
                } else {
                    const autoTitle = deriveTitleFromText(draftText);
                    setTitle(autoTitle);
                    isTitleManualRef.current = false;
                }

                const mode = gen.style?.mode ?? "preset";
                setStyleMode(mode);

                if (mode === "preset") {
                    setSelectedPresetId(gen.style?.preset_id ?? null);
                    setCustomPrompt("");
                } else {
                    setSelectedPresetId(null);
                    setCustomPrompt(gen.style?.custom_prompt ?? "");
                }

                if (gen.status === "queued" || gen.status === "processing") {
                    router.push(`/dashboard/history/${gen.id}`);
                    return;
                }
            } catch (e) {
                const msg = e instanceof Error ? e.message : "Failed to load pending generation";
                if (!cancelled) setError(msg);
            } finally {
                if (!cancelled) setIsBootLoading(false);
            }
        }

        void loadPending();
        return () => {
            cancelled = true;
        };
    }, [router]);

    // If presets finish loading and we still don't have a selected preset id, pick first.
    useEffect(() => {
        if (styleMode !== "preset") return;
        if (selectedPresetId) return;
        if (!presets.length) return;
        setSelectedPresetId(presets[0]!.id);
    }, [presets, selectedPresetId, styleMode]);

    // Title auto update while user has not manually edited it.
    useEffect(() => {
        if (isBootLoading) return;
        if (isTitleManualRef.current) return;

        const autoTitle = deriveTitleFromText(inputText);
        setTitle(autoTitle);
    }, [inputText, isBootLoading]);

    function clearSaveTimer() {
        if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
    }

    useEffect(() => {
        return () => {
            clearSaveTimer();
            if (updateFlashTimerRef.current) window.clearTimeout(updateFlashTimerRef.current);
        };
    }, []);

    function buildUpdatePayload(): UpdatePendingPayload | null {
        if (!generation?.id) return null;

        const t = title.trim();

        if (styleMode === "preset") {
            const pid = selectedPresetId?.trim();
            if (!pid) return null;
            return {
                title: t ? t : "",
                input_text: inputText.trim() ? inputText : undefined,
                style: { mode: "preset", preset_id: pid },
            };
        }

        const cp = customPrompt.trim();
        if (!cp) return null;
        return {
            title: t ? t : "",
            input_text: inputText.trim() ? inputText : undefined,
            style: { mode: "custom", custom_prompt: cp },
        };
    }

    async function patchPending(payload: UpdatePendingPayload): Promise<void> {
        if (!generation?.id) throw new Error("No pending generation");

        const res = await fetch(`/api/generations/${generation.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            cache: "no-store",
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data?.error ?? "Failed to update draft");
        }

        const data = await res.json().catch(() => null);
        const gen = data?.generation as PublicNoteGeneration | undefined;
        if (gen?.id) setGeneration(gen);

        flashUpdated();
    }

    function scheduleAutosave() {
        clearSaveTimer();

        const payload = buildUpdatePayload();
        if (!payload) return;

        const signature = JSON.stringify(payload);
        if (signature === lastSavedSignatureRef.current) return;

        saveTimerRef.current = window.setTimeout(async () => {
            setError(null);
            setNotice(null);
            setIsSaving(true);

            try {
                await patchPending(payload);
                lastSavedSignatureRef.current = signature;
            } catch (e) {
                const msg = e instanceof Error ? e.message : "Failed to save draft";
                setError(msg);
            } finally {
                setIsSaving(false);
            }
        }, 450);
    }

    // 3) Autosave on changes (pending-only editing)
    useEffect(() => {
        if (!generation?.id) return;
        if (isBootLoading) return;
        if (generation.status !== "pending") return;
        scheduleAutosave();
    }, [
        title,
        inputText,
        styleMode,
        selectedPresetId,
        customPrompt,
        generation?.id,
        generation?.status,
        isBootLoading,
    ]);

    async function uploadFileNow(file: File): Promise<void> {
        if (!generation?.id) throw new Error("No pending generation");
        if (generation.status !== "pending") throw new Error("Draft is locked");

        setError(null);
        setNotice(null);
        setIsUploading(true);

        try {
            const form = new FormData();
            form.append("file", file);

            const res = await fetch(`/api/generations/${generation.id}/files`, {
                method: "POST",
                body: form,
                cache: "no-store",
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error ?? "Failed to upload file");
            }

            const updated = await refreshGeneration(generation.id);
            const count = updated.input_files?.length ?? 0;

            setNotice(`Uploaded and attached (${count}/${MAX_FILES}).`);
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = "";
            setIsUploading(false);
        }
    }

    async function onPickFile(fileList: FileList | null) {
        const f = fileList?.item(0) ?? null;

        setError(null);
        setNotice(null);

        if (!generation?.id) {
            if (fileInputRef.current) fileInputRef.current.value = "";
            setError("Pending generation not ready yet");
            return;
        }

        if (generation.status !== "pending") {
            if (fileInputRef.current) fileInputRef.current.value = "";
            setError("Draft is locked while generating");
            return;
        }

        const currentCount = generation.input_files?.length ?? 0;
        if (currentCount >= MAX_FILES) {
            if (fileInputRef.current) fileInputRef.current.value = "";
            setError(`Max ${MAX_FILES} files. Delete one to upload another.`);
            return;
        }

        if (!f) return;

        if (!isAllowedUploadType(f)) {
            if (fileInputRef.current) fileInputRef.current.value = "";
            setError("Unsupported file type. Only images and PDFs are allowed.");
            return;
        }

        if (f.size <= 0) {
            if (fileInputRef.current) fileInputRef.current.value = "";
            setError("Empty file.");
            return;
        }

        if (f.size > MAX_FILE_SIZE_BYTES) {
            if (fileInputRef.current) fileInputRef.current.value = "";
            setError("File too large. Max is 5MB per file.");
            return;
        }

        if (isUploading || isDeletingFile || isSaving || isSubmitting) {
            if (fileInputRef.current) fileInputRef.current.value = "";
            return;
        }

        try {
            await uploadFileNow(f);
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to upload file";
            setError(msg);
        }
    }

    async function deleteAttachedFile(fileUrlOrKey: string): Promise<void> {
        if (!generation?.id) throw new Error("No pending generation");
        if (generation.status !== "pending") throw new Error("Draft is locked");

        setError(null);
        setNotice(null);
        setIsDeletingFile(true);

        try {
            const res = await fetch(
                `/api/generations/${generation.id}/files?fileKey=${encodeURIComponent(fileUrlOrKey)}`,
                { method: "DELETE", cache: "no-store" }
            );

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error ?? "Failed to delete file");
            }

            await refreshGeneration(generation.id);
            setNotice("File removed from this draft.");
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to delete file";
            setError(msg);
        } finally {
            setIsDeletingFile(false);
        }
    }

    async function submitToQueue(id: string): Promise<PublicNoteGeneration> {
        const res = await fetch(`/api/generations/${id}/submit`, {
            method: "POST",
            cache: "no-store",
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data?.error ?? "Failed to submit generation");
        }

        const data = (await res.json().catch(() => null)) as
            | { ok?: boolean; generation?: PublicNoteGeneration }
            | PublicNoteGeneration
            | null;

        const gen =
            data && typeof (data as any).id === "string"
                ? (data as PublicNoteGeneration)
                : (data as any)?.generation;

        if (!gen?.id) throw new Error("Invalid submit response");
        setGeneration(gen);
        return gen;
    }

    async function onGenerate() {
        setError(null);
        setNotice(null);

        if (!generation?.id) {
            setError("Pending generation not ready yet");
            return;
        }

        if (generation.status !== "pending") {
            router.push(`/dashboard/history/${generation.id}`);
            return;
        }

        if (styleMode === "preset" && !selectedPresetId) {
            setError("Pick a preset to continue.");
            return;
        }

        if (styleMode === "custom" && !customPrompt.trim()) {
            setError("Custom prompt is required for custom mode.");
            return;
        }

        const hasAnyExistingFiles = (generation.input_files?.length ?? 0) > 0;

        if (!inputText.trim() && !hasAnyExistingFiles) {
            setError("Add some text or upload one file.");
            return;
        }

        const payload = buildUpdatePayload();
        if (!payload) {
            setError("Missing required fields");
            return;
        }

        setIsSubmitting(true);

        // 1) Save draft
        try {
            setIsSaving(true);
            await patchPending(payload);
            lastSavedSignatureRef.current = JSON.stringify(payload);
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to save draft";
            setError(msg);
            setIsSaving(false);
            setIsSubmitting(false);
            return;
        } finally {
            setIsSaving(false);
        }

        // 2) Submit to queue
        try {
            const submitted = await submitToQueue(generation.id);
            router.push(`/dashboard/history/${submitted.id}`);
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to submit generation";
            setError(msg);
            setIsSubmitting(false);
        }
    }

    if (isBootLoading) {
        return (
            <div className="mx-auto max-w-6xl px-6 py-10 text-sm text-zinc-600 dark:text-zinc-400">
                Loading playground...
            </div>
        );
    }

    const gridClass = "grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6";
    const attachedFiles = generation?.input_files ?? [];
    const canUploadMore = attachedFiles.length < MAX_FILES;
    const isBusy = isUploading || isDeletingFile || isSaving || isSubmitting;

    const canEdit = generation?.status === "pending" && !isBusy;

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Playground</h1>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        Upload notes, pick a style, generate a one page study sheet.
                    </p>
                </div>

                <div className="flex gap-3">
                    <Button onClick={onGenerate} disabled={isBusy || !generation?.id}>
                        {isBusy ? "Saving..." : "Generate image"}
                    </Button>
                </div>
            </div>

            {error ? (
                <div className="rounded-lg border border-zinc-200/70 bg-white/60 px-3 py-2 text-sm text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
                    {error}
                </div>
            ) : null}

            {notice ? (
                <div className="rounded-lg border border-zinc-200/70 bg-white/60 px-3 py-2 text-sm text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
                    {notice}
                </div>
            ) : null}

            <div className="grid gap-4">
                <Card className="border-zinc-200/70 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-white/5">
                    <CardHeader>
                        <CardTitle className="text-base">Setup</CardTitle>
                    </CardHeader>

                    <CardContent className="space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="title">Title</Label>
                            <Input
                                id="title"
                                value={title}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    setTitle(v);
                                    isTitleManualRef.current = Boolean(v.trim());
                                }}
                                placeholder="Optional name"
                                disabled={!canEdit}
                            />
                            <div className="text-xs text-zinc-600 dark:text-zinc-400">
                                Auto fills from the first line of Notes text until you type a custom title.
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="files">Upload file</Label>

                            {canUploadMore ? (
                                <>
                                    <Input
                                        ref={fileInputRef}
                                        id="files"
                                        type="file"
                                        accept="image/*,application/pdf"
                                        onChange={(e) => void onPickFile(e.target.files)}
                                        disabled={!canEdit}
                                    />

                                    <div className="text-xs text-zinc-600 dark:text-zinc-400">
                                        Upload up to {MAX_FILES} files, one at a time (max 5MB each).{" "}
                                        {isUploading ? "Uploading..." : null}
                                    </div>
                                </>
                            ) : (
                                <div className="rounded-lg border border-zinc-200/70 bg-white/60 px-3 py-2 text-sm text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
                                    You reached the {MAX_FILES} file limit. Delete a file to upload another.
                                </div>
                            )}

                            {attachedFiles.length ? (
                                <div className="mt-2 rounded-lg border border-zinc-200/70 bg-white/60 p-3 dark:border-white/10 dark:bg-white/5">
                                    <div className="mb-2 flex items-center justify-between gap-3 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                                        <span>Attached files</span>
                                        <span className="text-zinc-600 dark:text-zinc-400">
                                            {attachedFiles.length}/{MAX_FILES}
                                        </span>
                                    </div>

                                    <div className="space-y-3">
                                        {attachedFiles.map((u) => {
                                            const label = fileLabelFromUrl(u);
                                            return (
                                                <div
                                                    key={u}
                                                    className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                                                >
                                                    <div className="min-w-0">
                                                        <div className="truncate text-sm text-zinc-900 dark:text-zinc-100">
                                                            {label}
                                                        </div>
                                                        <div className="truncate text-[11px] text-zinc-600 dark:text-zinc-400">
                                                            {u}
                                                        </div>
                                                    </div>

                                                    <div className="flex gap-2">
                                                        <Button variant="outline" size="sm" asChild disabled={isBusy}>
                                                            <a href={u} target="_blank" rel="noreferrer">
                                                                <ExternalLink className="mr-2 h-4 w-4" />
                                                                Open
                                                            </a>
                                                        </Button>

                                                        <Button
                                                            variant="destructive"
                                                            size="sm"
                                                            onClick={() => void deleteAttachedFile(u)}
                                                            disabled={!canEdit}
                                                        >
                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                            {isDeletingFile ? "Deleting..." : "Delete"}
                                                        </Button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-xs text-zinc-600 dark:text-zinc-400">
                                    No files attached yet.
                                </div>
                            )}
                        </div>

                        <div className="space-y-3">
                            <div className="text-xs text-zinc-600 dark:text-zinc-400">
                                Pick a style preset, or use Custom.
                            </div>

                            <div className={gridClass}>
                                {presets.map((p) => {
                                    const active = styleMode === "preset" && p.id === selectedPresetId;

                                    return (
                                        <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => {
                                                if (!canEdit) return;
                                                setStyleMode("preset");
                                                setSelectedPresetId(p.id);
                                            }}
                                            aria-pressed={active}
                                            disabled={!canEdit}
                                            className={[
                                                "group relative w-full overflow-hidden rounded-xl border text-left transition",
                                                "shadow-sm hover:shadow-lg active:shadow-md",
                                                !canEdit ? "opacity-60 cursor-not-allowed" : "",
                                                active
                                                    ? "border-zinc-900 bg-zinc-50 shadow-lg dark:border-white dark:bg-white/10"
                                                    : "border-zinc-200/70 bg-white/60 hover:bg-zinc-100/70 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10",
                                            ].join(" ")}
                                        >
                                            <div className="relative aspect-square w-full">
                                                {p.image_url ? (
                                                    <>
                                                        <Image
                                                            src={p.image_url}
                                                            alt={p.title}
                                                            fill
                                                            className="object-cover"
                                                            sizes="(min-width: 1024px) 16vw, (min-width: 640px) 33vw, 50vw"
                                                            priority={false}
                                                        />
                                                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-3 pb-3 pt-10 backdrop-blur-[1px]">
                                                            <div className="text-sm font-semibold text-white leading-snug drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
                                                                {p.title}
                                                            </div>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="flex h-full w-full items-end bg-zinc-100 dark:bg-white/5">
                                                        <div className="w-full p-3">
                                                            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                                                {p.title}
                                                            </div>
                                                            <div className="mt-0.5 text-[11px] text-zinc-600 dark:text-zinc-400">
                                                                {p.key}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {active ? (
                                                    <div className="pointer-events-none absolute inset-0 ring-2 ring-zinc-900 dark:ring-white" />
                                                ) : null}
                                            </div>
                                        </button>
                                    );
                                })}

                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!canEdit) return;
                                        setStyleMode("custom");
                                        setSelectedPresetId(null);
                                    }}
                                    aria-pressed={styleMode === "custom"}
                                    disabled={!canEdit}
                                    className={[
                                        "group relative w-full overflow-hidden rounded-xl border text-left transition",
                                        "shadow-sm hover:shadow-lg active:shadow-md",
                                        !canEdit ? "opacity-60 cursor-not-allowed" : "",
                                        styleMode === "custom"
                                            ? "border-zinc-900 bg-zinc-50 shadow-lg dark:border-white dark:bg-white/10"
                                            : "border-zinc-200/70 bg-white/60 hover:bg-zinc-100/70 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10",
                                    ].join(" ")}
                                >
                                    <div className="relative aspect-square w-full">
                                        <div className="flex h-full w-full items-center justify-center">
                                            <div className="flex flex-col items-center gap-3 px-6 text-center">
                                                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-zinc-200/70 bg-white/70 dark:border-white/10 dark:bg-white/5">
                                                    <Plus className="h-6 w-6 text-zinc-900 dark:text-zinc-100" />
                                                </div>
                                                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                                    Custom
                                                </div>
                                                <div className="text-[11px] text-zinc-600 dark:text-zinc-400">
                                                    Write your own prompt
                                                </div>
                                            </div>
                                        </div>

                                        {styleMode === "custom" ? (
                                            <div className="pointer-events-none absolute inset-0 ring-2 ring-zinc-900 dark:ring-white" />
                                        ) : null}
                                    </div>
                                </button>
                            </div>

                            {styleMode === "custom" ? (
                                <div className="mt-2 space-y-2">
                                    <Label htmlFor="custom">Custom prompt</Label>
                                    <Textarea
                                        id="custom"
                                        value={customPrompt}
                                        onChange={(e) => setCustomPrompt(e.target.value)}
                                        placeholder='Example: "Make it more artistic and colorful, keep text readable."'
                                        className="min-h-28"
                                        disabled={!canEdit}
                                    />
                                    <div className="text-xs text-zinc-600 dark:text-zinc-400">
                                        Custom prompt is public safe. snapshot_prompt stays private in DB.
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="text">Notes text</Label>
                            <Textarea
                                id="text"
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                placeholder="Paste text notes here (optional if you uploaded a file)"
                                className="min-h-40"
                                disabled={!canEdit}
                            />
                        </div>

                        <div className="text-xs text-zinc-600 dark:text-zinc-400">
                            Draft autosaves while status is pending.{" "}
                            {isSaving ? "Saving..." : didUpdateFlash ? "Updated" : null}
                        </div>

                        {generation?.id ? (
                            <div className="text-xs text-zinc-600 dark:text-zinc-400">Draft id: {generation.id}</div>
                        ) : null}

                        {styleMode === "preset" && selectedPreset ? (
                            <div className="text-xs text-zinc-600 dark:text-zinc-400">
                                Selected preset: <span className="font-medium">{selectedPreset.title}</span>
                            </div>
                        ) : null}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}