"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { connectSocket } from "@/lib/socket";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Toast from "@/components/Toast";

export default function BookingsPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [bookings, setBookings] = useState<any[]>([]);
    const [requests, setRequests] = useState<any[]>([]);
    const [fetching, setFetching] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

    useEffect(() => {
        if (!loading && !user) router.push("/login");
    }, [user, loading, router]);

    const loadData = async () => {
        try {
            const [bookingsRes, requestsRes] = await Promise.all([
                api("/bookings"),
                user?.role === "customer" ? api("/requests/my") : Promise.resolve({ data: { requests: [] } }),
            ]);
            setBookings(bookingsRes.data.bookings || []);
            setRequests(requestsRes.data.requests || []);
        } catch (err) {
            console.error(err);
        } finally {
            setFetching(false);
        }
    };

    useEffect(() => {
        if (user) loadData();
    }, [user]);

    useEffect(() => {
        if (!user) return;
        const socket = connectSocket();
        socket.on("booking:status", (data) => {
            setBookings((prev) =>
                prev.map((b) => (b.id === data.bookingId ? { ...b, status: data.status } : b))
            );
        });
        return () => { socket.off("booking:status"); };
    }, [user]);

    const cancelRequest = async (id: number) => {
        if (!confirm("Cancel this request?")) return;
        try {
            await api(`/requests/${id}/cancel`, { method: "POST" });
            setToast({ message: "Request cancelled", type: "success" });
            loadData();
        } catch (err: any) {
            setToast({ message: err.message, type: "error" });
        }
    };

    const cancelBooking = async (id: number) => {
        if (!confirm("Cancel this booking?")) return;
        try {
            await api(`/bookings/${id}/cancel`, { method: "POST", body: JSON.stringify({ reason: "Cancelled by user" }) });
            setToast({ message: "Booking cancelled", type: "success" });
            loadData();
        } catch (err: any) {
            setToast({ message: err.message, type: "error" });
        }
    };

    if (loading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    const statusColor: Record<string, string> = {
        searching: "bg-purple-100 text-purple-700",
        accepted: "bg-blue-100 text-blue-700",
        on_the_way: "bg-yellow-100 text-yellow-700",
        in_progress: "bg-orange-100 text-orange-700",
        completed: "bg-green-100 text-green-700",
        cancelled: "bg-red-100 text-red-700",
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <header className="bg-white border-b sticky top-0 z-10">
                <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
                    <Link href="/" className="text-xl font-bold text-blue-600">Localink</Link>
                    <Link href="/" className="text-sm text-gray-500 hover:underline">← Back</Link>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 py-8">
                <h1 className="text-2xl font-bold mb-6">My Bookings</h1>

                {fetching ? (
                    <div className="flex justify-center py-16">
                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <>
                        {/* Open Requests (Customer only) */}
                        {user.role === "customer" && requests.filter(r => r.status === "searching").length > 0 && (
                            <div className="mb-10">
                                <h2 className="font-semibold text-lg mb-4">Open Requests</h2>
                                <div className="space-y-3">
                                    {requests.filter(r => r.status === "searching").map((r) => (
                                        <div key={r.id} className="bg-white rounded-2xl border p-5">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h3 className="font-semibold">{r.title}</h3>
                                                    <p className="text-sm text-gray-500">{r.address}</p>
                                                    <p className="text-sm text-gray-500">Service: {r.service_name}</p>
                                                    <span className="inline-block mt-2 text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-700">
                                                        Searching for provider...
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={() => cancelRequest(r.id)}
                                                    className="text-sm text-red-600 hover:underline"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Bookings */}
                        <h2 className="font-semibold text-lg mb-4">
                            {user.role === "customer" ? "Active & Past Bookings" : "Your Jobs"}
                        </h2>

                        {bookings.length === 0 ? (
                            <div className="bg-white rounded-2xl border p-10 text-center">
                                <div className="text-4xl mb-3">📋</div>
                                <p className="text-gray-500 mb-4">No bookings yet</p>
                                {user.role === "customer" && (
                                    <Link href="/request" className="inline-block bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700">
                                        Request a service
                                    </Link>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {bookings.map((b) => (
                                    <div key={b.id} className="bg-white rounded-2xl border shadow-sm p-5">
                                        <div className="flex justify-between items-start gap-3 mb-2">
                                            <h3 className="font-semibold text-lg">{b.title}</h3>
                                            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColor[b.status] || "bg-gray-100"}`}>
                                                {b.status.replace("_", " ")}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-500">{b.address}</p>
                                        <p className="text-sm text-gray-500">
                                            {user.role === "customer" ? `Provider: ${b.provider_name}` : `Customer: ${b.customer_name}`}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-2">{new Date(b.created_at).toLocaleString()}</p>

                                        <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t">
                                            <Link href={`/chat/${b.id}`} className="text-sm text-blue-600 hover:underline font-medium">
                                                Open Chat →
                                            </Link>
                                            {user.role === "customer" && b.status === "completed" && (
                                                <Link href={`/review/${b.id}`} className="text-sm text-green-600 hover:underline font-medium">
                                                    Leave Review →
                                                </Link>
                                            )}
                                            {!["completed", "cancelled"].includes(b.status) && (
                                                <button onClick={() => cancelBooking(b.id)} className="text-sm text-red-600 hover:underline">
                                                    Cancel
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}