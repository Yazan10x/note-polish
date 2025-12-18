// src/app/dashboard/playground/page.tsx
"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";

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

function deriveTitleFromText(text: string): string {
    const t = text?.trim() ?? "";
    if (!t) return "";
    const firstLine = t.split(/\r?\n/)[0]?.trim() ?? "";
    return firstLine.slice(0, 80);
}

export default function PlaygroundPage() {
    const [title, setTitle] = useState("");
    const [inputText, setInputText] = useState("");

    const [pickedFiles, setPickedFiles] = useState<File[]>([]);
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

    const [didUpdateFlash, setDidUpdateFlash] = useState(false);

    const saveTimerRef = useRef<number | null>(null);
    const lastSavedSignatureRef = useRef<string>("");
    const updateFlashTimerRef = useRef<number | null>(null);

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

        loadPresets();
        return () => {
            cancelled = true;
        };
    }, []);

    // 2) Get or create pending generation
    // Note: server route exports POST, not GET.
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

                // Hydrate UI state from server draft
                const draftText = gen.input_text ?? "";
                setInputText(draftText);

                // Title hydrate: prefer server title if it exists, else derive from text
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
            } catch (e) {
                const msg = e instanceof Error ? e.message : "Failed to load pending generation";
                if (!cancelled) setError(msg);
            } finally {
                if (!cancelled) setIsBootLoading(false);
            }
        }

        loadPending();
        return () => {
            cancelled = true;
        };
    }, []);

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
        scheduleAutosave();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [title, inputText, styleMode, selectedPresetId, customPrompt, generation?.id, isBootLoading]);

    function onPickFiles(list: FileList | null) {
        if (!list) return;

        const arr = Array.from(list);
        const tooBig = arr.find((f) => f.size > MAX_FILE_SIZE_BYTES);
        if (tooBig) {
            setError(`File too large: ${tooBig.name}. Max is 5MB per file for MVP.`);
            return;
        }

        setError(null);
        setNotice(null);
        setPickedFiles(arr);
    }

    async function uploadPickedFiles(): Promise<void> {
        if (!generation?.id) throw new Error("No pending generation");
        if (!pickedFiles.length) return;

        setError(null);
        setNotice(null);
        setIsUploading(true);

        try {
            const form = new FormData();
            for (const f of pickedFiles) form.append("files", f);

            const res = await fetch(`/api/generations/${generation.id}/files`, {
                method: "POST",
                body: form,
                cache: "no-store",
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error ?? "Failed to upload files");
            }

            const data = (await res.json()) as { generation?: PublicNoteGeneration } | PublicNoteGeneration;
            const gen = "id" in (data as any) ? (data as PublicNoteGeneration) : (data as any).generation;
            if (gen?.id) setGeneration(gen);

            setPickedFiles([]);
            setNotice("Files uploaded");
        } finally {
            setIsUploading(false);
        }
    }

    async function onGenerate() {
        setError(null);
        setNotice(null);

        if (!generation?.id) {
            setError("Pending generation not ready yet");
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

        if (!inputText.trim() && (generation.input_files?.length ?? 0) === 0 && pickedFiles.length === 0) {
            setError("Add some text or upload at least one file.");
            return;
        }

        const payload = buildUpdatePayload();
        if (!payload) {
            setError("Missing required fields");
            return;
        }

        setIsSaving(true);
        try {
            await patchPending(payload);
            lastSavedSignatureRef.current = JSON.stringify(payload);
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to save draft";
            setError(msg);
            setIsSaving(false);
            return;
        } finally {
            setIsSaving(false);
        }

        if (pickedFiles.length) {
            try {
                await uploadPickedFiles();
            } catch (e) {
                const msg = e instanceof Error ? e.message : "Failed to upload files";
                setError(msg);
                return;
            }
        }

        setNotice("Draft is ready. Next step is Submit and polling.");
        // eslint-disable-next-line no-console
        console.log("Draft ready:", generation.id);
    }

    if (isBootLoading) {
        return (
            <div className="mx-auto max-w-6xl px-6 py-10 text-sm text-zinc-600 dark:text-zinc-400">
                Loading playground...
            </div>
        );
    }

    const gridClass = "grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6";

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
                    <Button
                        variant="outline"
                        onClick={uploadPickedFiles}
                        disabled={!pickedFiles.length || isUploading || !generation?.id}
                    >
                        {isUploading ? "Uploading..." : "Upload files"}
                    </Button>

                    <Button onClick={onGenerate} disabled={isSaving || isUploading || !generation?.id}>
                        {isSaving || isUploading ? "Saving..." : "Generate image"}
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
                            />
                            <div className="text-xs text-zinc-600 dark:text-zinc-400">
                                Auto fills from the first line of Notes text until you type a custom title.
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="files">Upload files</Label>
                            <Input
                                id="files"
                                type="file"
                                multiple
                                accept="image/*,application/pdf"
                                onChange={(e) => onPickFiles(e.target.files)}
                            />
                            {pickedFiles.length ? (
                                <div className="text-xs text-zinc-600 dark:text-zinc-400">
                                    {pickedFiles.length} file(s) picked (not uploaded yet)
                                </div>
                            ) : (
                                <div className="text-xs text-zinc-600 dark:text-zinc-400">
                                    Optional. You can generate from text only too.
                                </div>
                            )}
                        </div>

                        <div className="space-y-3">
                            <div className="text-xs text-zinc-600 dark:text-zinc-400">
                                Pick a style preset, or use Custom.
                            </div>

                            <div className={gridClass}>
                                {/* Presets first */}
                                {presets.map((p) => {
                                    const active = styleMode === "preset" && p.id === selectedPresetId;

                                    return (
                                        <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => {
                                                setStyleMode("preset");
                                                setSelectedPresetId(p.id);
                                            }}
                                            aria-pressed={active}
                                            className={[
                                                "group relative w-full overflow-hidden rounded-xl border text-left transition",
                                                "shadow-sm hover:shadow-lg active:shadow-md",
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

                                {/* Custom last */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setStyleMode("custom");
                                        setSelectedPresetId(null);
                                    }}
                                    aria-pressed={styleMode === "custom"}
                                    className={[
                                        "group relative w-full overflow-hidden rounded-xl border text-left transition",
                                        "shadow-sm hover:shadow-lg active:shadow-md",
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
                                placeholder="Paste text notes here (optional if you uploaded files)"
                                className="min-h-40"
                            />
                        </div>

                        <div className="text-xs text-zinc-600 dark:text-zinc-400">
                            Draft autosaves while status is pending.{" "}
                            {isSaving ? "Saving..." : didUpdateFlash ? "Updated" : null}
                        </div>

                        {generation?.id ? (
                            <div className="text-xs text-zinc-600 dark:text-zinc-400">Draft id: {generation.id}</div>
                        ) : null}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}