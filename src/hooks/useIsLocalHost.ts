import { useSyncExternalStore } from "react";

function subscribe() {
    return () => {};
}

function getSnapshot() {
    if (typeof window === "undefined") return false;
    const h = window.location.hostname;
    return h === "localhost" || h === "127.0.0.1" || h.endsWith(".local");
}

function getServerSnapshot() {
    return false;
}

export function useIsLocalHost() {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}