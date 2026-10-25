"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Toast from "@/components/Toast";

export default function ProviderProfilePage() {
    const { user, loading } = useAuth();
    const router = useRouter();

    const [form, setForm] = useState({
        businessName: "",
        bio: "",
        phone: "",
        fullName: "",
        email: "",
    });
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
    const [loadingProfile, setLoadingProfile] = useState(true);

    useEffect(() => {
        if (!loading && !user) {
            router.replace("/login");
            return;
        }
        if (user && user.role !== "provider") {
            router.replace("/");
        }
    }, [user, loading, router]);

    useEffect(() => {
        if (!user) return;

        api("/providers/me")
            .then((res) => {
                const p = res.data.profile;
                setForm({
                    businessName: p.business_name || "",
                    bio: p.bio || "",
                    phone: p.phone || "",
                    fullName: p.full_name || "",
                    email: p.email || "",
                });
            })
            .catch(console.error)
            .finally(() => setLoadingProfile(false));
    }, [user]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api("/providers/me", {
                method: "PUT",
                body: JSON.stringify({
                    businessName: form.businessName,
                    bio: form.bio,
                    phone: form.phone,
                }),
            });
            setToast({ message: "Profile updated successfully", type: "success" });
        } catch (err: any) {
            setToast({ message: err.message || "Failed to update", type: "error" });
        } finally {
            setSaving(false);
        }
    };

    if (loading || !user || loadingProfile) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
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
                <div className="max-w-xl mx-auto px-4 py-4 flex items-center justify-between">
                    <Link
                        href="/provider"
                        className="text-sm text-gray-500 hover:underline"
                    >
                        ← Back to Dashboard
                    </Link>
                    <h1 className="font-semibold text-gray-900">My Profile</h1>
                    <div className="w-20"></div>
                </div>
            </header>

            <main className="max-w-xl mx-auto px-4 py-8">
                <form
                    onSubmit={handleSubmit}
                    className="bg-white rounded-2xl border shadow-sm p-6 space-y-5"
                >
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Full Name
                        </label>
                        <input
                            type="text"
                            value={form.fullName}
                            disabled
                            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 bg-gray-50 text-gray-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Email
                        </label>
                        <input
                            type="email"
                            value={form.email}
                            disabled
                            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 bg-gray-50 text-gray-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Business Name
                        </label>
                        <input
                            type="text"
                            value={form.businessName}
                            onChange={(e) =>
                                setForm({ ...form, businessName: e.target.value })
                            }
                            placeholder="e.g. Ravi Plumbing Services"
                            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Phone
                        </label>
                        <input
                            type="tel"
                            value={form.phone}
                            onChange={(e) => setForm({ ...form, phone: e.target.value })}
                            placeholder="Your contact number"
                            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Bio / About
                        </label>
                        <textarea
                            value={form.bio}
                            onChange={(e) => setForm({ ...form, bio: e.target.value })}
                            rows={4}
                            placeholder="Tell customers about your experience..."
                            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-60 transition flex items-center justify-center gap-2"
                    >
                        {saving ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Saving...
                            </>
                        ) : (
                            "Save Profile"
                        )}
                    </button>
                </form>
            </main>
        </div>
    );
}