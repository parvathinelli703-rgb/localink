"use client";

import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function HomePage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role === "provider") {
      router.replace("/provider");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // ========== ADMIN HOME ==========
  if (user.role === "admin") {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b">
          <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
            <h1 className="text-xl font-bold text-blue-600">Localink</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">{user.fullName || user.email}</span>
              <button onClick={logout} className="text-sm text-red-600 hover:underline">
                Logout
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 py-10">
          <h2 className="text-2xl font-bold mb-2">Admin Dashboard</h2>
          <p className="text-gray-500 mb-8">Manage providers and the platform</p>

          <Link
            href="/admin"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 transition"
          >
            Open Admin Panel →
          </Link>
        </main>
      </div>
    );
  }

  // ========== CUSTOMER HOME ==========
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-blue-600">Localink</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 hidden sm:block">
              {user.fullName}
            </span>
            <button onClick={logout} className="text-sm text-red-600 hover:underline">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10">
        <div className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-1">
            Hello, {user.fullName?.split(" ")[0] || "there"} 👋
          </h2>
          <p className="text-gray-500">What do you need help with today?</p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Link
            href="/request"
            className="group bg-blue-600 text-white p-6 rounded-2xl hover:bg-blue-700 transition shadow-sm hover:shadow-md"
          >
            <div className="text-3xl mb-3">🔧</div>
            <h3 className="font-semibold text-lg mb-1">Request a Service</h3>
            <p className="text-blue-100 text-sm">
              Need a plumber, electrician or AC repair?
            </p>
          </Link>

          <Link
            href="/bookings"
            className="group bg-white border border-gray-200 p-6 rounded-2xl hover:border-blue-400 transition shadow-sm hover:shadow-md"
          >
            <div className="text-3xl mb-3">📋</div>
            <h3 className="font-semibold text-lg mb-1 text-gray-900">My Bookings</h3>
            <p className="text-gray-500 text-sm">
              Track your current and past jobs
            </p>
          </Link>
        </div>
      </main>
    </div>
  );
}