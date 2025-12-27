import { useEffect, useState } from "react";

export function useIsLocalHost() {
    const [isLocal, setIsLocal] = useState(false);

    useEffect(() => {
        const h = window.location.hostname;
        setIsLocal(h === "localhost" || h === "127.0.0.1" || h.endsWith(".local"));
    }, []);

    return isLocal;
}