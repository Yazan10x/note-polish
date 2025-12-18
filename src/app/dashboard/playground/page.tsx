// src/app/dashboard/playground/page.tsx
"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

import type { PublicNoteGeneration, PublicStylePreset } from "@/lib/models/noteGeneration";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";

type StyleMode = "preset" | "custom";

type UpdatePendingPayload = {
    input_text?: string;
    style: { mode: "preset"; preset_id: string } | { mode: "custom"; custom_prompt: string };
};

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB per file

export default function PlaygroundPage() {
    const [title, setTitle] = useState(""); // optional UI only (not saved yet)
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

    const saveTimerRef = useRef<number | null>(null);
    const lastSavedSignatureRef = useRef<string>("");

    const fallbackPresets: PublicStylePreset[] = useMemo(
        () => [
            {
                id: "fallback_readable_clean",
                key: "readable_clean",
                title: "More readable (same style)",
                sort_order: 1,
                image_url: "/presets/readable_clean.png",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            },
            {
                id: "fallback_colorful_poppy",
                key: "colorful_poppy",
                title: "Colorful + poppy (same style)",
                sort_order: 2,
                image_url: "/presets/colorful_poppy.png",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            },
            {
                id: "fallback_readable_with_diagrams",
                key: "readable_with_diagrams",
                title: "More readable + diagrams",
                sort_order: 3,
                image_url: "/presets/readable_with_diagrams.png",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            },
            {
                id: "fallback_colorful_with_diagrams",
                key: "colorful_with_diagrams",
                title: "Colorful + poppy + diagrams",
                sort_order: 4,
                image_url: "/presets/colorful_with_diagrams.png",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            },
            {
                id: "fallback_cheatsheet_text_only",
                key: "cheatsheet_text_only",
                title: "Cheat sheet (no diagrams, max text)",
                sort_order: 5,
                image_url: "/presets/cheatsheet_text_only.png",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            },
        ],
        []
    );

    const selectedPreset = useMemo(() => {
        if (!selectedPresetId) return null;
        return presets.find((p) => p.id === selectedPresetId) ?? null;
    }, [presets, selectedPresetId]);

    // 1) Load presets
    useEffect(() => {
        let cancelled = false;

        async function loadPresets() {
            try {
                const res = await fetch("/api/style-presets", { method: "GET", cache: "no-store" });
                if (!res.ok) throw new Error("Failed");

                const data = (await res.json()) as { presets: PublicStylePreset[] };
                if (cancelled) return;

                const sorted = [...(data.presets ?? [])].sort((a, b) => a.sort_order - b.sort_order);
                if (!sorted.length) throw new Error("No presets");

                setPresets(sorted);
            } catch {
                if (cancelled) return;
                const sorted = [...fallbackPresets].sort((a, b) => a.sort_order - b.sort_order);
                setPresets(sorted);
            }
        }

        loadPresets();
        return () => {
            cancelled = true;
        };
    }, [fallbackPresets]);

    // 2) Get or create pending generation
    // NOTE: server route currently exports POST, not GET.
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
                setInputText(gen.input_text ?? "");

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
    // This avoids "must pick preset" errors when the pending gen doesn't have preset_id yet.
    useEffect(() => {
        if (styleMode !== "preset") return;
        if (selectedPresetId) return;
        if (!presets.length) return;
        setSelectedPresetId(presets[0]!.id);
    }, [presets, selectedPresetId, styleMode]);

    function clearSaveTimer() {
        if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
    }

    useEffect(() => {
        return () => {
            clearSaveTimer();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function buildUpdatePayload(): UpdatePendingPayload | null {
        if (!generation?.id) return null;

        if (styleMode === "preset") {
            const pid = selectedPresetId?.trim();
            if (!pid) return null;
            return {
                input_text: inputText.trim() ? inputText : undefined,
                style: { mode: "preset", preset_id: pid },
            };
        }

        const cp = customPrompt.trim();
        if (!cp) return null;
        return {
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

        // Some routes return { ok: true }, some may return { generation }
        const data = await res.json().catch(() => null);
        const gen = data?.generation as PublicNoteGeneration | undefined;
        if (gen?.id) setGeneration(gen);
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
                setNotice("Draft saved");
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
    }, [inputText, styleMode, selectedPresetId, customPrompt, generation?.id, isBootLoading]);

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

        // Ensure latest draft is saved, then upload files if any.
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

        // Submission and polling come next (not implemented yet)
        setNotice("Draft is ready. Next step is Submit and polling.");
        // eslint-disable-next-line no-console
        console.log("Draft ready:", generation.id);
    }

    const inputsSummary = useMemo(() => {
        const already = generation?.input_files?.length ?? 0;
        const picked = pickedFiles.length;
        const t = inputText.trim() ? "Text included" : "No text";
        const filesLabel = already + picked > 0 ? `${already} uploaded, ${picked} picked` : "No files";
        return `${filesLabel} · ${t}`;
    }, [generation?.input_files?.length, pickedFiles.length, inputText]);

    if (isBootLoading) {
        return (
            <div className="mx-auto max-w-6xl px-6 py-10 text-sm text-zinc-600 dark:text-zinc-400">
                Loading playground...
            </div>
        );
    }

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

            <div className="grid gap-4 lg:grid-cols-3">
                <Card className="lg:col-span-1 border-zinc-200/70 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-white/5">
                    <CardHeader>
                        <CardTitle className="text-base">Setup</CardTitle>
                    </CardHeader>

                    <CardContent className="space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="title">Title</Label>
                            <Input
                                id="title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Optional name"
                            />
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

                        <Tabs value={styleMode} onValueChange={(v) => setStyleMode(v as StyleMode)} className="w-full">
                            <TabsList className="w-full">
                                <TabsTrigger className="flex-1" value="preset">
                                    Preset
                                </TabsTrigger>
                                <TabsTrigger className="flex-1" value="custom">
                                    Custom
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="preset" className="mt-4 space-y-3">
                                <div className="grid gap-2">
                                    {presets.map((p) => {
                                        const active = p.id === selectedPresetId;
                                        return (
                                            <button
                                                key={p.id}
                                                type="button"
                                                onClick={() => setSelectedPresetId(p.id)}
                                                className={[
                                                    "flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm",
                                                    active
                                                        ? "border-zinc-900 bg-zinc-50 dark:border-white dark:bg-white/10"
                                                        : "border-zinc-200/70 bg-white/60 hover:bg-zinc-100/70 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10",
                                                ].join(" ")}
                                            >
                                                <div className="font-medium">{p.title}</div>
                                                <div className="text-xs text-zinc-600 dark:text-zinc-400">{p.key}</div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </TabsContent>

                            <TabsContent value="custom" className="mt-4 space-y-2">
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
                            </TabsContent>
                        </Tabs>

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
                            Draft autosaves while status is pending. {isSaving ? "Saving..." : null}
                        </div>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2 border-zinc-200/70 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-white/5">
                    <CardHeader>
                        <CardTitle className="text-base">Preview</CardTitle>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        <div className="rounded-lg border border-zinc-200/70 bg-white/60 p-4 dark:border-white/10 dark:bg-white/5">
                            <div className="text-sm font-medium">Selected style</div>
                            <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                                {styleMode === "preset" ? selectedPreset?.title ?? "Pick a preset" : "Custom prompt"}
                            </div>
                        </div>

                        {styleMode === "preset" && selectedPreset?.image_url ? (
                            <div className="overflow-hidden rounded-xl border border-zinc-200/70 bg-white/60 dark:border-white/10 dark:bg-white/5">
                                <div className="relative aspect-[3/4] w-full">
                                    <Image
                                        src={selectedPreset.image_url}
                                        alt={selectedPreset.title}
                                        fill
                                        className="object-cover"
                                        sizes="(max-width: 1024px) 100vw, 800px"
                                        priority={false}
                                    />
                                </div>
                            </div>
                        ) : generation?.preview_images?.length ? (
                            <div className="grid gap-3 sm:grid-cols-2">
                                {generation.preview_images.slice(0, 4).map((src, idx) => (
                                    <div
                                        key={`${idx}-${src.slice(0, 20)}`}
                                        className="overflow-hidden rounded-xl border border-zinc-200/70 bg-white/60 dark:border-white/10 dark:bg-white/5"
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={src} alt={`Preview ${idx + 1}`} className="h-full w-full object-cover" />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-xl border border-dashed border-zinc-300 bg-white/40 p-8 text-sm text-zinc-600 dark:border-white/15 dark:bg-white/5 dark:text-zinc-400">
                                When you submit later, preview_images from OpenAI can show up here.
                            </div>
                        )}

                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-lg border border-zinc-200/70 bg-white/60 p-4 text-sm dark:border-white/10 dark:bg-white/5">
                                <div className="font-medium">Inputs</div>
                                <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{inputsSummary}</div>
                            </div>
                            <div className="rounded-lg border border-zinc-200/70 bg-white/60 p-4 text-sm dark:border-white/10 dark:bg-white/5">
                                <div className="font-medium">Output</div>
                                <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                                    One portrait image (phone-friendly)
                                </div>
                            </div>
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