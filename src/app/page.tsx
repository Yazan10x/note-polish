// src/app/page.tsx
"use client";

import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const PILL_ITEMS = [
    "Paste or upload",
    "Style presets",
    "Exam sheet mode",
    "High contrast",
    "Download",
    "History",
] as const;

const BEST_FOR = ["Exam review sheets", "Lecture summaries", "Quick last minute revision"] as const;

const STEPS = [
    { title: "1. Input", body: "Paste notes or upload text." },
    { title: "2. Style", body: "Pick a preset format." },
    { title: "3. Export", body: "Preview and download." },
] as const;

const STYLE_OPTIONS = [
    "More readable (same style)",
    "Colorful + poppy (same style)",
    "More readable + diagrams",
    "Colorful + poppy + diagrams",
    "Cheat sheet (no diagrams, max text)",
] as const;

// Letter-ish page ratio (8.5 x 11)
const PAGE_ASPECT = "aspect-[85/110]";

export default function Home() {
    return (
        <main className="min-h-screen bg-white text-black dark:bg-black dark:text-white">
            <BackgroundGlow />

            <div className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
                <Header />

                <section className="mt-10 space-y-10">
                    <HeroTop />
                    <BeforeAfterShowcase />

                    <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
                        <HowItWorksCard />
                        <CtaCard />
                    </div>

                    {/* NEW: Playground preview section */}
                    <PlaygroundShowcase />
                </section>

                <Footer />
            </div>
        </main>
    );
}

function BackgroundGlow() {
    return (
        <div className="absolute inset-0 -z-10">
            <div className="h-full w-full bg-[radial-gradient(60%_50%_at_50%_0%,rgba(94,165,0,0.18),rgba(154,230,0,0.06)_35%,transparent_70%)] dark:bg-[radial-gradient(60%_50%_at_50%_0%,rgba(154,230,0,0.14),rgba(94,165,0,0.05)_35%,transparent_70%)]" />
        </div>
    );
}

function Header() {
    return (
        <header className="flex items-center justify-between">
            <div className="flex items-center gap-4">
                <Image src="/icon.png" alt="Note Polisher" width={46} height={46} priority />
                <div className="leading-tight">
                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Note Polisher</div>
                    <div className="text-xs text-zinc-600 dark:text-zinc-400">One page study sheets</div>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <Button asChild variant="ghost">
                    <Link href="/login">Sign in</Link>
                </Button>
                <Button asChild>
                    <Link href="/signup">Get started</Link>
                </Button>
            </div>
        </header>
    );
}

function HeroTop() {
    return (
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <div className="pt-1">
                <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200/70 bg-white/70 px-3 py-1 text-xs text-zinc-700 backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
                    <span className="h-2 w-2 rounded-full bg-[oklch(0.648_0.2_131.684)]" />
                    Clean formatting, instantly
                </div>

                <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
                    Turn raw notes into a clean, one page study sheet.
                </h1>

                <p className="mt-5 max-w-xl text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
                    Paste notes, choose a style, and generate a polished output with structure and hierarchy, ready to
                    preview and download.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <Button asChild className="sm:w-auto">
                        <Link href="/signup">Get started</Link>
                    </Button>
                    <Button asChild variant="outline" className="sm:w-auto">
                        <a href="#examples">See examples</a>
                    </Button>
                </div>

                <div className="mt-8 flex flex-wrap gap-2">
                    {PILL_ITEMS.map((t) => (
                        <Pill key={t}>{t}</Pill>
                    ))}
                </div>
            </div>

            <div className="lg:pt-3">
                <Card className="border-zinc-200/70 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-white/5">
                    <CardContent className="p-5 sm:p-6">
                        <div className="text-sm font-medium">Using ChatGPT Images 1.5.</div>
                        <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                            Your notes are transformed into a structured study sheet with readable hierarchy and clean
                            spacing.
                        </div>

                        <div className="mt-4 rounded-2xl border border-zinc-200/70 bg-white/60 p-4 text-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
                            <div className="font-medium">Best for</div>
                            <div className="mt-2 grid gap-1 text-zinc-600 dark:text-zinc-400">
                                {BEST_FOR.map((t) => (
                                    <div key={t}>• {t}</div>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function BeforeAfterShowcase() {
    return (
        <section id="examples" className="relative">
            <div className="relative overflow-hidden rounded-3xl border border-zinc-200/70 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 sm:p-6">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_55%_at_50%_0%,rgba(94,165,0,0.18),transparent_60%)] dark:bg-[radial-gradient(70%_55%_at_50%_0%,rgba(154,230,0,0.12),transparent_60%)]" />

                <div className="relative hidden lg:block">
                    <div className="relative grid gap-8 lg:grid-cols-2 lg:items-start">
                        <BigShot title="Before" src="/example/img1_before.png" />
                        <BigShot title="After" src="/example/img1_after.png" />
                    </div>

                    <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
                        <ArrowOverlay />
                    </div>
                </div>

                <div className="relative grid gap-4 lg:hidden">
                    <BigShot title="Before" src="/example/img1_before.png" />
                    <div className="flex justify-center py-1">
                        <ArrowBadge compact />
                    </div>
                    <BigShot title="After" src="/example/img1_after.png" />
                </div>

                <div className="relative mt-6 grid gap-3 sm:grid-cols-3">
                    <MiniPoint title="Less noise" body="Clean spacing and consistent headings." />
                    <MiniPoint title="Clear hierarchy" body="Sections, bullets, and emphasis where it matters." />
                    <MiniPoint title="Fast review" body="Designed to scan quickly and retain more." />
                </div>
            </div>

            <style jsx global>{`
                @keyframes npPulse {
                    0% {
                        transform: translateZ(0) scale(1);
                    }
                    50% {
                        transform: translateZ(0) scale(1.035);
                    }
                    100% {
                        transform: translateZ(0) scale(1);
                    }
                }
                @keyframes npShimmer {
                    0% {
                        transform: translateX(-45%);
                        opacity: 0;
                    }
                    20% {
                        opacity: 0.75;
                    }
                    100% {
                        transform: translateX(45%);
                        opacity: 0;
                    }
                }
                @keyframes npLineGlow {
                    0% {
                        opacity: 0.45;
                    }
                    50% {
                        opacity: 0.85;
                    }
                    100% {
                        opacity: 0.45;
                    }
                }
            `}</style>
        </section>
    );
}

function BigShot({ title, src }: { title: string; src: string }) {
    return (
        <div className="w-full">
            <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100">{title}</div>
                <div className="text-[11px] text-zinc-600 dark:text-zinc-400">Letter page</div>
            </div>

            <div
                className={[
                    "relative w-full overflow-hidden rounded-3xl border shadow-sm",
                    "border-zinc-200/70 bg-white/60 dark:border-white/10 dark:bg-white/5",
                    PAGE_ASPECT,
                ].join(" ")}
            >
                <div className="absolute inset-0 p-3 sm:p-4">
                    <div className="relative h-full w-full overflow-hidden rounded-2xl bg-white/70 dark:bg-black/20">
                        <Image
                            src={src}
                            alt={`${title} example`}
                            fill
                            className="object-contain"
                            sizes="(min-width: 1024px) 520px, 100vw"
                            priority={false}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

function ArrowOverlay() {
    return (
        <div className="relative">
            <div
                className="absolute left-1/2 top-1/2 h-[2px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-transparent via-zinc-900/35 to-transparent dark:via-white/30"
                style={{ animation: "npLineGlow 2.4s ease-in-out infinite" }}
            />
            <div className="relative">
                <ArrowBadge />
            </div>
        </div>
    );
}

function ArrowBadge({ compact }: { compact?: boolean }) {
    return (
        <div
            className={[
                "relative select-none rounded-full border backdrop-blur",
                "border-zinc-200/70 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5",
                compact ? "px-4 py-2" : "px-6 py-3",
            ].join(" ")}
            style={{ animation: "npPulse 2.1s ease-in-out infinite" }}
        >
            <div className="absolute inset-0 overflow-hidden rounded-full">
                <div
                    className="absolute inset-y-0 left-0 w-[60%] bg-gradient-to-r from-transparent via-black/10 to-transparent dark:via-white/10"
                    style={{ animation: "npShimmer 3.3s ease-in-out infinite" }}
                />
            </div>

            <div className="relative flex items-center gap-3">
                <div className="text-xs font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                    Note Polishing
                </div>

                <div className="relative h-3 w-16">
                    <div className="absolute left-0 top-1/2 h-[2px] w-full -translate-y-1/2 bg-zinc-900/80 dark:bg-white/80" />
                    <div className="absolute right-0 top-1/2 h-0 w-0 -translate-y-1/2 border-y-[6px] border-l-[10px] border-y-transparent border-l-zinc-900/80 dark:border-l-white/80" />
                </div>
            </div>
        </div>
    );
}

function HowItWorksCard() {
    return (
        <Card className="relative overflow-hidden border-zinc-200/70 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-white/5">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_45%_at_70%_10%,rgba(94,165,0,0.18),transparent_60%)] dark:bg-[radial-gradient(55%_45%_at_70%_10%,rgba(154,230,0,0.12),transparent_60%)]" />
            <CardContent className="relative p-6 sm:p-8">
                <div>
                    <div className="text-sm font-medium">How it works</div>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                        Note Polisher takes messy, inconsistent notes and turns them into a clean, readable study sheet
                        that is easier to review.
                    </p>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    {STEPS.map((s) => (
                        <Feature key={s.title} title={s.title}>
                            {s.body}
                        </Feature>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

function CtaCard() {
    return (
        <Card className="border-zinc-200/70 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-white/5">
            <CardContent className="p-6 sm:p-8">
                <div className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200/70 bg-white/60 p-4 text-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
                    <div>
                        <div className="font-medium">Ready to start?</div>
                        <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                            Sign in with your email to save history.
                        </div>
                    </div>

                    <Button asChild size="sm">
                        <Link href="/signup">Continue</Link>
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

function PlaygroundShowcase() {
    return (
        <section className="pt-2">
            <div className="rounded-3xl border border-zinc-200/70 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 sm:p-6">
                <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
                    <div>
                        <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            Customize your output in the Playground
                        </div>
                        <div className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                            Pick one of five styles to match your exam prep: readability, color, and optional diagrams.
                        </div>

                        <div className="mt-5 grid gap-2">
                            {STYLE_OPTIONS.map((t) => (
                                <div
                                    key={t}
                                    className="rounded-2xl border border-zinc-200/70 bg-white/60 px-4 py-3 text-sm text-zinc-800 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200"
                                >
                                    {t}
                                </div>
                            ))}
                        </div>

                        <div className="mt-6 flex gap-3">
                            <Button asChild>
                                <Link href="/signup">Try the Playground</Link>
                            </Button>
                            <Button asChild variant="outline">
                                <Link href="/login">Sign in</Link>
                            </Button>
                        </div>
                    </div>

                    <div>
                        <div className="mb-2 flex items-center justify-between">
                            <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100">Playground</div>
                            <div className="text-[11px] text-zinc-600 dark:text-zinc-400">Dashboard preview</div>
                        </div>

                        <div className="relative overflow-hidden rounded-3xl border border-zinc-200/70 bg-white/60 shadow-sm dark:border-white/10 dark:bg-white/5">
                            <div className="relative aspect-[16/10] w-full">
                                <Image
                                    src="/playground.png"
                                    alt="Playground dashboard preview"
                                    fill
                                    className="object-contain p-3 sm:p-4"
                                    sizes="(min-width: 1024px) 520px, 100vw"
                                    priority={false}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

function MiniPoint({ title, body }: { title: string; body: string }) {
    return (
        <div className="rounded-2xl border border-zinc-200/70 bg-white/60 p-4 text-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
            <div className="font-medium">{title}</div>
            <div className="mt-1 text-zinc-600 dark:text-zinc-400">{body}</div>
        </div>
    );
}

function Feature({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="rounded-2xl border border-zinc-200/70 bg-white/60 p-4 text-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
            <div className="font-medium">{title}</div>
            <div className="mt-1 text-zinc-600 dark:text-zinc-400">{children}</div>
        </div>
    );
}

function Pill({ children }: { children: React.ReactNode }) {
    return (
        <span className="inline-flex items-center rounded-full border border-zinc-200/70 bg-white/60 px-3 py-1 text-xs text-zinc-700 backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
            {children}
        </span>
    );
}

function Footer() {
    return (
        <footer className="mt-16 border-t border-zinc-200/70 pt-6 text-xs text-zinc-500 dark:border-white/10 dark:text-zinc-500">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>© {new Date().getFullYear()} Note Polisher</div>

                <div>
                    Built by{" "}
                    <a
                        href="https://armoush.com"
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-zinc-900 underline underline-offset-4 dark:text-zinc-100"
                    >
                        Yazan Armoush
                    </a>
                </div>
            </div>
        </footer>
    );
}