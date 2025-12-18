import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: {
        default: "Note Polish",
        template: "%s | Note Polish",
    },
    description:
        "Turn raw notes into a clean, one page study sheet. Paste notes, choose a style, and generate a polished output ready to preview and download.",
    applicationName: "Note Polish",
    authors: [{ name: "Yazan Armoush", url: "https://armoush.com" }],
    creator: "Yazan Armoush",
    publisher: "Yazan Armoush",
    metadataBase: new URL("https://notepolish.com"),
    alternates: {
        canonical: "/",
    },
    openGraph: {
        type: "website",
        url: "/",
        title: "Note Polish",
        siteName: "Note Polish",
        description:
            "Turn raw notes into a clean, one page study sheet. Paste notes, choose a style, and generate a polished output ready to preview and download.",
        images: [
            {
                url: "/icon.png",
                width: 1024,
                height: 1024,
                alt: "Note Polish",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: "Note Polish",
        description:
            "Turn raw notes into a clean, one page study sheet. Paste notes, choose a style, and generate a polished output ready to preview and download.",
        images: ["/icon.png"],
    },
    icons: {
        icon: [{ url: "/favicon.ico" }, { url: "/icon.png", type: "image/png" }],
        apple: [{ url: "/icon.png", type: "image/png" }],
    },
};

export default function RootLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        </body>
        </html>
    );
}