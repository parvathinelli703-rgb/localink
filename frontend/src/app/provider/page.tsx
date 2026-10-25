"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { connectSocket } from "@/lib/socket";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ProviderDashboard() {
    const { user, loading, logout } = useAuth();
    const router = useRouter();

    const [isOnline, setIsOnline] = useState(false);
    const [message, setMessage] = useState("");
    const [bookings, setBookings] = useState<any[]>([]);
    const [openRequests, setOpenRequests] = useState<any[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [actionLoading, setActionLoading] = useState<number | null>(null);

    useEffect(() => {
        if (!loading && !user) {
            router.replace("/login");
            return;
        }
        if (user && user.role !== "provider") {
            router.replace("/");
        }
    }, [user, loading, router]);

    const fetchData = async () => {
        try {
            const [bookingsRes, openRes] = await Promise.all([
                api("/bookings"),
                api("/requests/open"),
            ]);
            setBookings(bookingsRes.data.bookings || []);
            setOpenRequests(openRes.data.requests || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingData(false);
        }
    };

    useEffect(() => {
        if (user) fetchData();
    }, [user]);

    // Real-time listeners
    useEffect(() => {
        if (!user) return;

        const socket = connectSocket();

        socket.on("request:new", () => {
            fetchData();
        });

        socket.on("request:taken", (data) => {
            setOpenRequests((prev) => prev.filter((r) => r.id !== data.requestId));
        });

        return () => {
            socket.off("request:new");
            socket.off("request:taken");
        };
    }, [user]);

    const toggleOnline = async () => {
        setMessage("");
        try {
            const res = await api("/providers/online", {
                method: "POST",
                body: JSON.stringify({
                    isOnline: !isOnline,
                    lat: 28.6139,
                    lng: 77.2090,
                }),
            });
            setIsOnline(res.data.isOnline);
            setMessage(res.data.isOnline ? "✅ You are now ONLINE" : "You are now OFFLINE");
        } catch (err: any) {
            setMessage(err.message || "Failed to update status");
        }
    };

    const acceptRequest = async (requestId: number) => {
        setActionLoading(requestId);
        try {
            await api(`/requests/${requestId}/accept`, { method: "POST" });
            setMessage("Request accepted successfully!");
            await fetchData();
        } catch (err: any) {
            alert(err.message || "Failed to accept request");
        } finally {
            setActionLoading(null);
        }
    };

    const updateStatus = async (bookingId: number, status: string) => {
        setActionLoading(bookingId);
        try {
            await api(`/bookings/${bookingId}/status`, {
                method: "PATCH",
                body: JSON.stringify({ status }),
            });
            await fetchData();
        } catch (err: any) {
            alert(err.message || "Failed to update status");
        } finally {
            setActionLoading(null);
        }
    };

    if (loading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    const statusColor: Record<string, string> = {
        accepted: "bg-blue-100 text-blue-700",
        on_the_way: "bg-yellow-100 text-yellow-800",
        in_progress: "bg-orange-100 text-orange-800",
        completed: "bg-green-100 text-green-800",
        cancelled: "bg-red-100 text-red-700",
    };

    const getNextAction = (status: string) => {
        switch (status) {
            case "accepted":
                return { label: "On the Way", next: "on_the_way", color: "bg-yellow-500 hover:bg-yellow-600" };
            case "on_the_way":
                return { label: "Start Job", next: "in_progress", color: "bg-orange-500 hover:bg-orange-600" };
            case "in_progress":
                return { label: "Complete Job", next: "completed", color: "bg-green-600 hover:bg-green-700" };
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white border-b sticky top-0 z-10">
                <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
                    <Link href="/" className="text-xl font-bold text-blue-600">
                        Localink
                    </Link>
                    <div className="flex items-center gap-4">
                        <Link href="/provider/profile" className="text-sm text-blue-600 hover:underline">
                            Profile
                        </Link>
                        <span className="text-sm text-gray-600">{user.fullName || user.email}</span>
                        <button onClick={logout} className="text-sm text-red-600 hover:underline">
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 py-8">
                <h1 className="text-2xl font-bold mb-1">Provider Dashboard</h1>
                <p className="text-gray-500 mb-8">Hello, {user.fullName || user.email}</p>

                {/* Availability */}
                <div className="bg-white rounded-2xl shadow-sm border p-6 mb-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="font-semibold text-lg">Availability</h2>
                            <p className="text-sm text-gray-500">
                                {isOnline
                                    ? "You are visible to nearby customers"
                                    : "You are offline – customers cannot see you"}
                            </p>
                        </div>
                        <button
                            onClick={toggleOnline}
                            className={`px-6 py-2.5 rounded-lg font-medium text-white transition ${isOnline ? "bg-red-500 hover:bg-red-600" : "bg-green-600 hover:bg-green-700"
                                }`}
                        >
                            {isOnline ? "Go Offline" : "Go Online"}
                        </button>
                    </div>
                    {message && (
                        <p
                            className={`mt-3 text-sm ${message.includes("ONLINE") || message.includes("accepted")
                                    ? "text-green-600"
                                    : "text-gray-600"
                                }`}
                        >
                            {message}
                        </p>
                    )}
                </div>

                {/* Incoming Requests */}
                <h2 className="font-semibold text-lg mb-4">Incoming Requests</h2>
                {loadingData ? (
                    <p className="text-gray-500 mb-8">Loading...</p>
                ) : openRequests.length === 0 ? (
                    <div className="bg-white rounded-2xl border p-6 text-center text-gray-500 mb-8">
                        No open requests at the moment.
                    </div>
                ) : (
                    <div className="space-y-4 mb-10">
                        {openRequests.map((r) => (
                            <div key={r.id} className="bg-white rounded-2xl border shadow-sm p-5">
                                <div className="flex justify-between items-start gap-3">
                                    <div>
                                        <h3 className="font-semibold text-lg">{r.title}</h3>
                                        <p className="text-sm text-gray-500 mt-1">{r.address}</p>
                                        <p className="text-sm text-gray-500">Service: {r.service_name}</p>
                                        <p className="text-sm text-gray-500">Customer: {r.customer_name}</p>
                                    </div>
                                    <button
                                        onClick={() => acceptRequest(r.id)}
                                        disabled={actionLoading === r.id}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 whitespace-nowrap"
                                    >
                                        {actionLoading === r.id ? "Accepting..." : "Accept Job"}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Your Jobs */}
                <h2 className="font-semibold text-lg mb-4">Your Jobs</h2>
                {bookings.length === 0 ? (
                    <div className="bg-white rounded-2xl border p-6 text-center text-gray-500 mb-10">
                        No jobs yet.
                    </div>
                ) : (
                    <div className="space-y-4 mb-10">
                        {bookings.map((b) => {
                            const action = getNextAction(b.status);
                            return (
                                <div key={b.id} className="bg-white rounded-2xl border shadow-sm p-5">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h3 className="font-semibold text-lg">{b.title}</h3>
                                            <p className="text-sm text-gray-500 mt-1">{b.address}</p>
                                            <p className="text-sm text-gray-500">Customer: {b.customer_name}</p>
                                        </div>
                                        <span
                                            className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${statusColor[b.status] || "bg-gray-100"
                                                }`}
                                        >
                                            {b.status.replace("_", " ")}
                                        </span>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-3 mt-2">
                                        {action && (
                                            <button
                                                onClick={() => updateStatus(b.id, action.next)}
                                                disabled={actionLoading === b.id}
                                                className={`px-4 py-2 rounded-lg text-white text-sm font-medium ${action.color} disabled:opacity-50`}
                                            >
                                                {actionLoading === b.id ? "Updating..." : action.label}
                                            </button>
                                        )}

                                        {/* Chat button */}
                                        <Link
                                            href={`/chat/${b.id}`}
                                            className="text-sm text-blue-600 hover:underline font-medium"
                                        >
                                            Open Chat →
                                        </Link>
                                    </div>

                                    {b.status === "completed" && (
                                        <p className="text-sm text-green-600 font-medium mt-2">✓ Job completed</p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}