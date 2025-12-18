import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Home() {
    return (
        <main className="min-h-screen bg-white text-black dark:bg-black dark:text-white">
            <div className="absolute inset-0 -z-10">
                <div className="h-full w-full bg-[radial-gradient(60%_50%_at_50%_0%,rgba(94,165,0,0.18),rgba(154,230,0,0.06)_35%,transparent_70%)] dark:bg-[radial-gradient(60%_50%_at_50%_0%,rgba(154,230,0,0.14),rgba(94,165,0,0.05)_35%,transparent_70%)]" />
            </div>

            <div className="mx-auto max-w-6xl px-6 py-16">
                <header className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Image
                            src="/icon.png"
                            alt="Notes Polish"
                            width={46}
                            height={46}
                            priority
                        />
                        <div className="leading-tight">
                            <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                Notes Polish
                            </div>
                            <div className="text-xs text-zinc-600 dark:text-zinc-400">
                                One page study sheets
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button asChild variant="ghost">
                            <Link href="/login">Sign in</Link>
                        </Button>
                        <Button asChild>
                            <Link href="/login">Get started</Link>
                        </Button>
                    </div>
                </header>

                <section className="mt-16 grid gap-10 lg:grid-cols-2 lg:items-center">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200/70 bg-white/70 px-3 py-1 text-xs text-zinc-700 backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
                            <span className="h-2 w-2 rounded-full bg-[oklch(0.648_0.2_131.684)]" />
                            Clean formatting, instantly
                        </div>

                        <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
                            Turn raw notes into a clean, one page study sheet.
                        </h1>

                        <p className="mt-5 text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
                            Paste notes, choose a style, and generate a polished output with
                            structure and hierarchy, ready to preview and download.
                        </p>

                        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                            <Button asChild className="sm:w-auto">
                                <Link href="/login">Get started</Link>
                            </Button>
                            <Button asChild variant="outline" className="sm:w-auto">
                                <Link href="/login">See examples</Link>
                            </Button>
                        </div>

                        <div className="mt-8 flex flex-wrap gap-2">
                            <Pill>Paste or upload</Pill>
                            <Pill>Style presets</Pill>
                            <Pill>Exam sheet mode</Pill>
                            <Pill>High contrast</Pill>
                            <Pill>Download</Pill>
                            <Pill>History</Pill>
                        </div>
                    </div>

                    <Card className="relative overflow-hidden border-zinc-200/70 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-white/5">
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_40%_at_70%_10%,rgba(94,165,0,0.18),transparent_60%)] dark:bg-[radial-gradient(50%_40%_at_70%_10%,rgba(154,230,0,0.12),transparent_60%)]" />
                        <CardContent className="relative p-6 sm:p-8">
                            <div className="space-y-7">
                                <div>
                                    <div className="text-sm font-medium">How it works</div>
                                    <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                                        Notes Polish takes messy, inconsistent notes and turns them
                                        into a clean, readable study sheet that is easier to review.
                                    </p>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-3">
                                    <Feature title="1. Input">Paste notes or upload text.</Feature>
                                    <Feature title="2. Style">Pick a preset format.</Feature>
                                    <Feature title="3. Export">Preview and download.</Feature>
                                </div>

                                <div className="rounded-xl border border-zinc-200/70 bg-white/60 p-4 text-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
                                    <div className="font-medium">Best for</div>
                                    <div className="mt-2 grid gap-1 text-zinc-600 dark:text-zinc-400">
                                        <div>• Exam review sheets</div>
                                        <div>• Lecture summaries</div>
                                        <div>• Quick last minute revision</div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between rounded-xl border border-zinc-200/70 bg-white/60 p-4 text-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
                                    <div>
                                        <div className="font-medium">Ready to start?</div>
                                        <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                                            Sign in with your email to save history.
                                        </div>
                                    </div>
                                    <Button asChild size="sm">
                                        <Link href="/login">Continue</Link>
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </section>

                <footer className="mt-16 border-t border-zinc-200/70 pt-6 text-xs text-zinc-500 dark:border-white/10 dark:text-zinc-500">
                    © {new Date().getFullYear()} Notes Polish
                </footer>
            </div>
        </main>
    );
}

function Feature({
                     title,
                     children,
                 }: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div className="rounded-xl border border-zinc-200/70 bg-white/60 p-4 text-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
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