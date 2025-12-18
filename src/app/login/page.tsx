import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
    return (
        <main className="min-h-screen bg-white text-black dark:bg-black dark:text-white">
            <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6 py-16">
                <div className="grid w-full items-center gap-10 lg:grid-cols-2">
                    <div className="hidden lg:block">
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <Image src="/icon.png" alt="Notes Polish" width={44} height={44} priority />
                                <div>
                                    <div className="text-sm font-medium">Notes Polish</div>
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
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input id="email" type="email" placeholder="you@example.com" />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="password">Password</Label>
                                    <Input id="password" type="password" placeholder="••••••••" />
                                </div>

                                <Button asChild className="w-full">
                                    <Link href="/dashboard">Login</Link>
                                </Button>
                            </div>

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