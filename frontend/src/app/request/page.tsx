"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RequestPage() {
    const { user, loading } = useAuth();
    const router = useRouter();

    const [services, setServices] = useState<any[]>([]);
    const [form, setForm] = useState({
        serviceId: "",
        title: "",
        description: "",
        address: "Connaught Place, New Delhi",
        lat: 28.6139,
        lng: 77.2090,
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (!loading && !user) router.replace("/login");
        if (user && user.role !== "customer") router.replace("/");
    }, [user, loading, router]);

    useEffect(() => {
        api("/categories")
            .then((res) => {
                // Flatten services from categories
                const all: any[] = [];
                // If backend returns categories with services, adjust accordingly
                // For now fetch services if available
            })
            .catch(console.error);

        // Simple: hardcode common services or fetch
        api("/services")
            .then((res) => setServices(res.data.services || []))
            .catch(() => {
                // fallback
                setServices([
                    { id: 1, name: "Plumbing" },
                    { id: 2, name: "Electrical" },
                    { id: 3, name: "AC Repair" },
                    { id: 4, name: "Appliance Repair" },
                ]);
            });
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSubmitting(true);

        try {
            await api("/requests", {
                method: "POST",
                body: JSON.stringify({
                    serviceId: Number(form.serviceId),
                    title: form.title,
                    description: form.description,
                    address: form.address,
                    lat: form.lat,
                    lng: form.lng,
                }),
            });
            setSuccess(true);
            setTimeout(() => router.push("/bookings"), 1500);
        } catch (err: any) {
            setError(err.message || "Failed to create request");
        } finally {
            setSubmitting(false);
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
            <header className="bg-white border-b sticky top-0 z-10">
                <div className="max-w-xl mx-auto px-4 py-4 flex items-center justify-between">
                    <Link href="/" className="text-sm text-gray-500 hover:underline">
                        ← Back
                    </Link>
                    <h1 className="font-semibold text-gray-900">Request a Service</h1>
                    <div className="w-12"></div>
                </div>
            </header>

            <main className="max-w-xl mx-auto px-4 py-8">
                {success ? (
                    <div className="bg-green-50 text-green-700 p-6 rounded-2xl text-center">
                        <div className="text-4xl mb-3">✅</div>
                        <p className="font-medium">Request created successfully!</p>
                        <p className="text-sm mt-1">Redirecting to your bookings...</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border p-6 space-y-5">
                        {error && (
                            <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm">
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                Service Type
                            </label>
                            <select
                                value={form.serviceId}
                                onChange={(e) => setForm({ ...form, serviceId: e.target.value })}
                                required
                                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Select a service</option>
                                {services.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                Title
                            </label>
                            <input
                                type="text"
                                value={form.title}
                                onChange={(e) => setForm({ ...form, title: e.target.value })}
                                required
                                placeholder="e.g. Kitchen sink is leaking"
                                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                Description (optional)
                            </label>
                            <textarea
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                rows={3}
                                placeholder="Describe the problem..."
                                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                Address
                            </label>
                            <input
                                type="text"
                                value={form.address}
                                onChange={(e) => setForm({ ...form, address: e.target.value })}
                                required
                                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-60 transition flex items-center justify-center gap-2"
                        >
                            {submitting ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    Creating request...
                                </>
                            ) : (
                                "Submit Request"
                            )}
                        </button>
                    </form>
                )}
            </main>
        </div>
    );
}