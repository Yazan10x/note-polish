// src/app/dashboard/playground/page.tsx
"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import type { PublicStylePreset } from "@/lib/models/noteGeneration";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";

type StyleMode = "preset" | "custom";

type CreateGenerationPayload = {
    title?: string;
    input_text?: string;
    style: { mode: StyleMode; preset_id?: string; custom_prompt?: string };
};

export default function PlaygroundPage() {
    const [title, setTitle] = useState("");
    const [inputText, setInputText] = useState("");

    const [files, setFiles] = useState<File[]>([]);
    const [styleMode, setStyleMode] = useState<StyleMode>("preset");

    const [presets, setPresets] = useState<PublicStylePreset[]>([]);
    const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);

    const [customPrompt, setCustomPrompt] = useState("");

    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fallback presets so page works before API is wired
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

    useEffect(() => {
        let cancelled = false;

        async function loadPresets() {
            try {
                // If you don’t have this endpoint yet, it will fall back automatically.
                const res = await fetch("/api/style-presets", { method: "GET" });
                if (!res.ok) throw new Error("Failed");
                const data = (await res.json()) as { presets: PublicStylePreset[] };

                if (cancelled) return;

                const sorted = [...data.presets].sort((a, b) => a.sort_order - b.sort_order);
                setPresets(sorted);
                setSelectedPresetId(sorted[0]?.id ?? null);
            } catch {
                if (cancelled) return;
                const sorted = [...fallbackPresets].sort((a, b) => a.sort_order - b.sort_order);
                setPresets(sorted);
                setSelectedPresetId(sorted[0]?.id ?? null);
            }
        }

        loadPresets();
        return () => {
            cancelled = true;
        };
    }, [fallbackPresets]);

    const selectedPreset = useMemo(() => {
        if (!selectedPresetId) return null;
        return presets.find((p) => p.id === selectedPresetId) ?? null;
    }, [presets, selectedPresetId]);

    function onPickFiles(list: FileList | null) {
        if (!list) return;
        setFiles(Array.from(list));
    }

    async function onGenerate() {
        setError(null);

        if (styleMode === "preset" && !selectedPresetId) {
            setError("Pick a preset to continue.");
            return;
        }

        // Basic guardrail: you can tighten later
        if (!inputText.trim() && files.length === 0) {
            setError("Add some text or upload at least one file.");
            return;
        }

        const payload: CreateGenerationPayload = {
            title: title.trim() ? title.trim() : undefined,
            input_text: inputText.trim() ? inputText.trim() : undefined,
            style:
                styleMode === "preset"
                    ? { mode: "preset", preset_id: selectedPresetId ?? undefined }
                    : { mode: "custom", custom_prompt: customPrompt.trim() || undefined },
        };

        setIsSubmitting(true);
        try {
            // Recommended pattern: multipart for files
            const form = new FormData();
            form.set("json", JSON.stringify(payload));
            for (const f of files) form.append("files", f);

            // You’ll implement this endpoint next.
            // It should return the created generation id and initial status.
            const res = await fetch("/api/note-generations", {
                method: "POST",
                body: form,
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setError(data?.error ?? "Failed to start generation");
                return;
            }

            const data = (await res.json()) as { id: string };
            // Navigate to a details page later, or start polling here.
            // For now, just show success by clearing files and leaving inputs.
            setFiles([]);
            setError(null);

            // eslint-disable-next-line no-console
            console.log("Started generation:", data.id);
        } catch {
            setError("Failed to start generation");
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Playground</h1>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        Upload notes, pick a style, generate a one page study sheet.
                    </p>
                </div>

                <Button onClick={onGenerate} disabled={isSubmitting}>
                    {isSubmitting ? "Generating..." : "Generate image"}
                </Button>
            </div>

            {error ? (
                <div className="rounded-lg border border-zinc-200/70 bg-white/60 px-3 py-2 text-sm text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
                    {error}
                </div>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-3">
                {/* Left: Controls */}
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
                                placeholder="Optional name for this generation"
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
                            {files.length ? (
                                <div className="text-xs text-zinc-600 dark:text-zinc-400">
                                    {files.length} file(s) selected
                                </div>
                            ) : (
                                <div className="text-xs text-zinc-600 dark:text-zinc-400">
                                    Optional. You can generate from text only too.
                                </div>
                            )}
                        </div>

                        <Tabs
                            value={styleMode}
                            onValueChange={(v) => setStyleMode(v as StyleMode)}
                            className="w-full"
                        >
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
                                                <div className="text-xs text-zinc-600 dark:text-zinc-400">
                                                    {p.key}
                                                </div>
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
                                    This is shown to the user later, but your internal snapshot_prompt stays private.
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
                    </CardContent>
                </Card>

                {/* Right: Preview */}
                <Card className="lg:col-span-2 border-zinc-200/70 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-white/5">
                    <CardHeader>
                        <CardTitle className="text-base">Preview</CardTitle>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        <div className="rounded-lg border border-zinc-200/70 bg-white/60 p-4 dark:border-white/10 dark:bg-white/5">
                            <div className="text-sm font-medium">Selected style</div>
                            <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                                {styleMode === "preset"
                                    ? selectedPreset?.title ?? "Pick a preset"
                                    : "Custom prompt"}
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
                        ) : (
                            <div className="rounded-xl border border-dashed border-zinc-300 bg-white/40 p-8 text-sm text-zinc-600 dark:border-white/15 dark:bg-white/5 dark:text-zinc-400">
                                When you generate, preview images from OpenAI can show up here.
                            </div>
                        )}

                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-lg border border-zinc-200/70 bg-white/60 p-4 text-sm dark:border-white/10 dark:bg-white/5">
                                <div className="font-medium">Inputs</div>
                                <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                                    {files.length ? `${files.length} file(s)` : "No files"} ·{" "}
                                    {inputText.trim() ? "Text included" : "No text"}
                                </div>
                            </div>
                            <div className="rounded-lg border border-zinc-200/70 bg-white/60 p-4 text-sm dark:border-white/10 dark:bg-white/5">
                                <div className="font-medium">Output</div>
                                <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                                    One portrait image (phone-friendly)
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}