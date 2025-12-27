"use client";

import { useEffect } from "react";

const KEY_LARGE = "note_polisher:a11y_large";
const KEY_BOLD = "note_polisher:a11y_bold";
const KEY_CONTRAST = "note_polisher:a11y_contrast";
const KEY_REDUCE_MOTION = "note_polisher:a11y_reduce_motion";

export function A11yInit() {
    useEffect(() => {
        try {
            const root = document.documentElement;

            root.classList.toggle("a11y-large", localStorage.getItem(KEY_LARGE) === "1");
            root.classList.toggle("a11y-bold", localStorage.getItem(KEY_BOLD) === "1");
            root.classList.toggle("a11y-contrast", localStorage.getItem(KEY_CONTRAST) === "1");
            root.classList.toggle("a11y-reduce-motion", localStorage.getItem(KEY_REDUCE_MOTION) === "1");
        } catch {}
    }, []);

    return null;
}