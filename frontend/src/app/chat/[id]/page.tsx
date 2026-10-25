"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { connectSocket } from "@/lib/socket";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

function ChatContent() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const bookingId = Number(params.id);

    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!loading && !user) router.replace("/login");
    }, [user, loading, router]);

    // Load messages
    useEffect(() => {
        if (!user || !bookingId) return;

        api(`/bookings/${bookingId}/messages`)
            .then((res) => setMessages(res.data.messages || []))
            .catch(console.error);
    }, [user, bookingId]);

    // Real-time
    useEffect(() => {
        if (!user || !bookingId) return;

        const socket = connectSocket();
        socket.emit("booking:join", bookingId);

        socket.on("chat:message", (msg) => {
            setMessages((prev) => [...prev, msg]);
        });

        return () => {
            socket.off("chat:message");
        };
    }, [user, bookingId]);

    // Auto scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || sending) return;

        setSending(true);
        try {
            await api(`/bookings/${bookingId}/messages`, {
                method: "POST",
                body: JSON.stringify({ body: newMessage }),
            });
            setNewMessage("");
        } catch (err: any) {
            alert(err.message || "Failed to send");
        } finally {
            setSending(false);
        }
    };

    if (loading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <header className="bg-white border-b sticky top-0 z-10">
                <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
                    <Link
                        href="/bookings"
                        className="text-sm text-gray-500 hover:underline"
                    >
                        ← Back
                    </Link>
                    <h1 className="font-semibold text-gray-900">Chat</h1>
                    <div className="w-12"></div>
                </div>
            </header>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto max-w-2xl w-full mx-auto px-4 py-6 space-y-3">
                {messages.length === 0 && (
                    <div className="text-center py-16">
                        <div className="text-4xl mb-3">💬</div>
                        <p className="text-gray-400 text-sm">No messages yet. Say hello!</p>
                    </div>
                )}

                {messages.map((m) => {
                    const isMe = m.sender_id === user.id;
                    return (
                        <div
                            key={m.id}
                            className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                        >
                            <div
                                className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${isMe
                                        ? "bg-blue-600 text-white rounded-br-md"
                                        : "bg-white border rounded-bl-md"
                                    }`}
                            >
                                {!isMe && (
                                    <p className="text-xs font-medium text-gray-500 mb-1">
                                        {m.sender_name}
                                    </p>
                                )}
                                <p className="leading-relaxed">{m.body}</p>
                                <p
                                    className={`text-[10px] mt-1 ${isMe ? "text-blue-100" : "text-gray-400"
                                        }`}
                                >
                                    {new Date(m.created_at).toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                    })}
                                </p>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="bg-white border-t sticky bottom-0">
                <form
                    onSubmit={handleSend}
                    className="max-w-2xl mx-auto px-4 py-3 flex gap-2"
                >
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 border border-gray-300 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                        type="submit"
                        disabled={sending || !newMessage.trim()}
                        className="bg-blue-600 text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
                    >
                        {sending ? "..." : "Send"}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default function ChatPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen flex items-center justify-center bg-gray-50">
                    <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
            }
        >
            <ChatContent />
        </Suspense>
    );
}