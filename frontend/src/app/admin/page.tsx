"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Toast from "@/components/Toast";

export default function AdminPage() {
    const { user, loading, logout } = useAuth();
    const router = useRouter();

    const [providers, setProviders] = useState<any[]>([]);
    const [fetching, setFetching] = useState(true);
    const [actionLoading, setActionLoading] = useState<number | null>(null);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    useEffect(() => {
        if (!loading && !user) router.replace("/login");
        if (user && user.role !== "admin") router.replace("/");
    }, [user, loading, router]);

    const loadProviders = async () => {
        try {
            const res = await api("/admin/providers");
            setProviders(res.data.providers || []);
        } catch (err) {
            console.error(err);
        } finally {
            setFetching(false);
        }
    };

    useEffect(() => {
        if (user?.role === "admin") loadProviders();
    }, [user]);

    const approve = async (id: number) => {
        setActionLoading(id);
        try {
            await api(`/admin/providers/${id}/approve`, { method: "POST" });
            setToast({ message: "Provider approved", type: "success" });
            loadProviders();
        } catch (err: any) {
            setToast({ message: err.message || "Failed", type: "error" });
        } finally {
            setActionLoading(null);
        }
    };

    if (loading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}

            <header className="bg-white border-b sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-blue-600">Localink Admin</h1>
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-600">{user.fullName || user.email}</span>
                        <button onClick={logout} className="text-sm text-red-600 hover:underline">
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-8">
                <h2 className="text-2xl font-bold mb-6">Provider Approvals</h2>

                {fetching ? (
                    <div className="flex justify-center py-16">
                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : providers.length === 0 ? (
                    <div className="bg-white rounded-2xl border p-10 text-center text-gray-500">
                        No providers found
                    </div>
                ) : (
                    <div className="space-y-4">
                        {providers.map((p) => (
                            <div
                                key={p.id}
                                className="bg-white rounded-2xl border shadow-sm p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                            >
                                <div>
                                    <h3 className="font-semibold text-lg">
                                        {p.business_name || p.full_name}
                                    </h3>
                                    <p className="text-sm text-gray-500">{p.email}</p>
                                    {p.phone && <p className="text-sm text-gray-500">{p.phone}</p>}
                                    <p className="text-xs text-gray-400 mt-1">
                                        Joined: {new Date(p.created_at).toLocaleDateString()}
                                    </p>
                                </div>

                                <div className="flex items-center gap-3">
                                    {p.is_approved ? (
                                        <span className="text-sm font-medium text-green-600 bg-green-50 px-3 py-1.5 rounded-full">
                                            Approved
                                        </span>
                                    ) : (
                                        <button
                                            onClick={() => approve(p.id)}
                                            disabled={actionLoading === p.id}
                                            className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                                        >
                                            {actionLoading === p.id ? "Approving..." : "Approve"}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}