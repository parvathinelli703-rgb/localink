"use client";

import { useEffect, useState, Suspense } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

function ReviewContent() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const bookingId = Number(params.id);

    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");
    const [existingReview, setExistingReview] = useState<any>(null);

    useEffect(() => {
        if (!loading && !user) router.replace("/login");
        if (user && user.role !== "customer") router.replace("/");
    }, [user, loading, router]);

    useEffect(() => {
        if (!user || !bookingId) return;

        api(`/bookings/${bookingId}/review`)
            .then((res) => {
                if (res.data?.review) {
                    setExistingReview(res.data.review);
                }
            })
            .catch((err) => {
                // Just ignore if no review exists
                console.log("No existing review or error:", err.message);
            });
    }, [user, bookingId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSubmitting(true);

        try {
            await api(`/bookings/${bookingId}/review`, {
                method: "POST",
                body: JSON.stringify({ rating, comment }),
            });
            setSuccess(true);
            setTimeout(() => router.push("/bookings"), 1500);
        } catch (err: any) {
            setError(err.message || "Failed to submit review");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading || !user) {
        return <div className="p-10 text-center">Loading...</div>;
    }

    if (existingReview) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
                <div className="bg-white rounded-2xl shadow p-8 max-w-md w-full text-center">
                    <h1 className="text-xl font-bold mb-4">You already reviewed this job</h1>
                    <div className="text-yellow-500 text-2xl mb-2">
                        {"★".repeat(existingReview.rating)}
                        {"☆".repeat(5 - existingReview.rating)}
                    </div>
                    {existingReview.comment && (
                        <p className="text-gray-600 mb-6">"{existingReview.comment}"</p>
                    )}
                    <Link href="/bookings" className="text-blue-600 hover:underline">
                        ← Back to Bookings
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white border-b">
                <div className="max-w-md mx-auto px-4 py-4 flex items-center justify-between">
                    <Link href="/bookings" className="text-sm text-gray-500 hover:underline">
                        ← Back
                    </Link>
                    <h1 className="font-semibold">Leave a Review</h1>
                    <div className="w-12"></div>
                </div>
            </header>

            <main className="max-w-md mx-auto px-4 py-10">
                {success ? (
                    <div className="bg-green-50 text-green-700 p-6 rounded-2xl text-center">
                        Thank you for your review! Redirecting...
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow p-6 space-y-6">
                        {error && (
                            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>
                        )}

                        <div>
                            <label className="block text-sm font-medium mb-3">Rating</label>
                            <div className="flex gap-2">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        type="button"
                                        onClick={() => setRating(star)}
                                        className={`text-3xl ${star <= rating ? "text-yellow-400" : "text-gray-300"
                                            }`}
                                    >
                                        ★
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Comment (optional)</label>
                            <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                rows={4}
                                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="How was the service?"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                        >
                            {submitting ? "Submitting..." : "Submit Review"}
                        </button>
                    </form>
                )}
            </main>
        </div>
    );
}

export default function ReviewPage() {
    return (
        <Suspense fallback={<div className="p-10 text-center">Loading...</div>}>
            <ReviewContent />
        </Suspense>
    );
}