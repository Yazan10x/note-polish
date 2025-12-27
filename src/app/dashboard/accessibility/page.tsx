"use client";

import { useCallback } from "react";
import { useSyncExternalStore } from "react";
import { CheckCircle2, Contrast, Keyboard, Type, Bold, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const EVENT_NAME = "note_polisher:a11y_changed";

const KEY_LARGE = "note_polisher:a11y_large";
const KEY_BOLD = "note_polisher:a11y_bold";
const KEY_CONTRAST = "note_polisher:a11y_contrast";
const KEY_REDUCE_MOTION = "note_polisher:a11y_reduce_motion";

function subscribe(onStoreChange: () => void) {
    if (typeof window === "undefined") return () => {};
    const handler = () => onStoreChange();
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
}

function getBoolSnapshot(key: string) {
    return () => {
        if (typeof window === "undefined") return false;
        return localStorage.getItem(key) === "1";
    };
}

function getServerBoolSnapshot() {
    return false;
}

function setPref(key: string, className: string, next: boolean) {
    localStorage.setItem(key, next ? "1" : "0");
    document.documentElement.classList.toggle(className, next);
    window.dispatchEvent(new Event(EVENT_NAME));
}

function SupportedItem({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <CheckCircle2 className="mt-0.5 h-4 w-4 text-zinc-900 dark:text-zinc-100" />
            <span className="min-w-0">{children}</span>
        </div>
    );
}

function ToggleRow({
                       icon,
                       title,
                       description,
                       enabled,
                       onToggle,
                   }: {
    icon: React.ReactNode;
    title: string;
    description: string;
    enabled: boolean;
    onToggle: () => void;
}) {
    return (
        <div className="flex flex-col gap-3 rounded-xl border border-zinc-200/70 bg-white/60 p-4 dark:border-white/10 dark:bg-white/5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200/70 bg-white/70 dark:border-white/10 dark:bg-white/5">
                    {icon}
                </div>
                <div className="min-w-0">
                    <div className="text-sm font-medium">{title}</div>
                    <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{description}</div>
                </div>
            </div>

            <Button type="button" variant={enabled ? "default" : "outline"} onClick={onToggle} className="sm:w-28">
                {enabled ? "On" : "Off"}
            </Button>
        </div>
    );
}

export default function AccessibilityPage() {
    const large = useSyncExternalStore(subscribe, getBoolSnapshot(KEY_LARGE), () => getServerBoolSnapshot());
    const bold = useSyncExternalStore(subscribe, getBoolSnapshot(KEY_BOLD), () => getServerBoolSnapshot());
    const contrast = useSyncExternalStore(subscribe, getBoolSnapshot(KEY_CONTRAST), () => getServerBoolSnapshot());
    const reduceMotion = useSyncExternalStore(
        subscribe,
        getBoolSnapshot(KEY_REDUCE_MOTION),
        () => getServerBoolSnapshot()
    );

    const toggleLarge = useCallback(() => setPref(KEY_LARGE, "a11y-large", !large), [large]);
    const toggleBold = useCallback(() => setPref(KEY_BOLD, "a11y-bold", !bold), [bold]);
    const toggleContrast = useCallback(() => setPref(KEY_CONTRAST, "a11y-contrast", !contrast), [contrast]);
    const toggleReduceMotion = useCallback(
        () => setPref(KEY_REDUCE_MOTION, "a11y-reduce-motion", !reduceMotion),
        [reduceMotion]
    );

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight">Accessibility</h1>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Adjust the UI to match your needs. Settings are saved on this device.
                </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2 flex">
                    <div className="max-w-3xl w-full flex">
                        <Card className="w-full h-full border-zinc-200/70 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-white/5">
                            <CardHeader>
                                <CardTitle className="text-base">Display</CardTitle>
                            </CardHeader>

                            <CardContent className="space-y-3">
                                <ToggleRow
                                    icon={<Type className="h-4 w-4" />}
                                    title="Larger text and spacing"
                                    description="Increases base font size and line height across the app."
                                    enabled={large}
                                    onToggle={toggleLarge}
                                />
                                <ToggleRow
                                    icon={<Bold className="h-4 w-4" />}
                                    title="Bold text"
                                    description="Increases font weight for better readability."
                                    enabled={bold}
                                    onToggle={toggleBold}
                                />
                                <ToggleRow
                                    icon={<Contrast className="h-4 w-4" />}
                                    title="High contrast"
                                    description="Stronger borders and higher contrast text."
                                    enabled={contrast}
                                    onToggle={toggleContrast}
                                />
                                <ToggleRow
                                    icon={<Sparkles className="h-4 w-4" />}
                                    title="Reduce motion"
                                    description="Disables animations and transitions."
                                    enabled={reduceMotion}
                                    onToggle={toggleReduceMotion}
                                />
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <div className="lg:col-span-1 flex">
                    <div className="max-w-xl w-full flex">
                        <Card className="w-full h-full border-zinc-200/70 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-white/5">
                            <CardHeader>
                                <CardTitle className="text-base">Supported accessibility features</CardTitle>
                            </CardHeader>

                            <CardContent className="space-y-3">
                                <SupportedItem>Forms use visible labels for inputs.</SupportedItem>
                                <SupportedItem>Theme toggle includes an accessible aria label.</SupportedItem>
                                <SupportedItem>Errors are shown inline to help users correct input quickly.</SupportedItem>

                                <div className="mt-4 flex items-start gap-3 rounded-xl border border-zinc-200/70 bg-white/60 p-4 dark:border-white/10 dark:bg-white/5">
                                    <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200/70 bg-white/70 dark:border-white/10 dark:bg-white/5">
                                        <Keyboard className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-sm font-medium">Focus visibility</div>
                                        <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                                            Clear focus outlines for keyboard navigation are applied globally.
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-1 text-xs text-zinc-600 dark:text-zinc-400">
                                    Some accessibility behaviors weren’t fully tested due to limited testing equipment. Please create a GitHub issue if you
                                    notice anything broken so it can be fixed.
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}