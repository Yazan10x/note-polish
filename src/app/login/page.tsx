"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { LoginInputSchema } from "@/lib/models/user";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FieldErrors = {
    email?: string;
    password?: string;
};

export default function LoginPage() {
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setFieldErrors({});

        const parsed = LoginInputSchema.safeParse({ email, password });
        if (!parsed.success) {
            const flat = parsed.error.flatten().fieldErrors;
            setFieldErrors({
                email: flat.email?.[0],
                password: flat.password?.[0],
            });
            setError("Please fix the highlighted fields.");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(parsed.data),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setError(data?.error ?? "Login failed");
                return;
            }

            router.push("/dashboard");
            router.refresh();
        } catch {
            setError("Login failed");
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <main className="min-h-screen bg-white text-black dark:bg-black dark:text-white">
            <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6 py-16">
                <div className="grid w-full items-center gap-10 lg:grid-cols-2">
                    <div className="hidden lg:block">
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <Image src="/icon.png" alt="Note Polish" width={44} height={44} priority />
                                <div>
                                    <div className="text-sm font-medium">Note Polish</div>
                                    <div className="text-xs text-zinc-600 dark:text-zinc-400">
                                        One page study sheets
                                    </div>
                                </div>
                            </div>
                            <h1 className="text-3xl font-semibold tracking-tight">
                                Sign in to your workspace
                            </h1>
                            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                                Save your history, reuse styles, and keep your study sheets organized.
                            </p>
                        </div>
                    </div>

                    <Card className="border-zinc-200/70 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-white/5">
                        <CardHeader>
                            <CardTitle className="text-xl">Sign in</CardTitle>
                        </CardHeader>

                        <CardContent className="space-y-6">
                            <form onSubmit={onSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="you@example.com"
                                        autoComplete="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        disabled={isSubmitting}
                                        aria-invalid={Boolean(fieldErrors.email)}
                                    />
                                    {fieldErrors.email ? (
                                        <div className="text-xs text-zinc-600 dark:text-zinc-400">
                                            {fieldErrors.email}
                                        </div>
                                    ) : null}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="password">Password</Label>
                                    <Input
                                        id="password"
                                        type="password"
                                        placeholder="••••••••"
                                        autoComplete="current-password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        disabled={isSubmitting}
                                        aria-invalid={Boolean(fieldErrors.password)}
                                    />
                                    {fieldErrors.password ? (
                                        <div className="text-xs text-zinc-600 dark:text-zinc-400">
                                            {fieldErrors.password}
                                        </div>
                                    ) : null}
                                </div>

                                {error ? (
                                    <div className="rounded-lg border border-zinc-200/70 bg-white/60 px-3 py-2 text-sm text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
                                        {error}
                                    </div>
                                ) : null}

                                <Button type="submit" className="w-full" disabled={isSubmitting}>
                                    {isSubmitting ? "Signing in..." : "Login"}
                                </Button>
                            </form>

                            <div className="text-center text-sm text-zinc-600 dark:text-zinc-400">
                                New here?{" "}
                                <Link
                                    href="/signup"
                                    className="font-medium text-black underline underline-offset-4 dark:text-white"
                                >
                                    Create an account
                                </Link>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </main>
    );
}