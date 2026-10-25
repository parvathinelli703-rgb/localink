"use client";

import { useEffect } from "react";

interface ToastProps {
    message: string;
    type?: "success" | "error" | "info";
    onClose: () => void;
}

export default function Toast({ message, type = "info", onClose }: ToastProps) {
    useEffect(() => {
        const t = setTimeout(onClose, 3000);
        return () => clearTimeout(t);
    }, [onClose]);

    const bg = {
        success: "bg-green-600",
        error: "bg-red-600",
        info: "bg-blue-600",
    };

    return (
        <div className="fixed bottom-6 right-6 z-50">
            <div className={`${bg[type]} text-white px-5 py-3 rounded-xl shadow-lg min-w-[260px] flex items-center justify-between gap-3`}>
                <span className="text-sm font-medium">{message}</span>
                <button onClick={onClose} className="text-white/80 hover:text-white text-lg">×</button>
            </div>
        </div>
    );
}