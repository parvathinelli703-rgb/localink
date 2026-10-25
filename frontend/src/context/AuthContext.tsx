"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "@/lib/api";
import { connectSocket, disconnectSocket } from "@/lib/socket";

interface User {
    id: number;
    email: string;
    fullName: string;
    role: "customer" | "provider" | "admin";
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (data: any) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const saved = localStorage.getItem("token");
        if (saved) {
            setToken(saved);
            api("/auth/me")
                .then((res) => {
                    const u = res.data.user;
                    setUser({
                        id: u.id,
                        email: u.email,
                        fullName: u.full_name || u.fullName || u.email,
                        role: u.role,
                    });
                    // Connect socket after loading user
                    connectSocket();
                })
                .catch(() => {
                    localStorage.removeItem("token");
                    setToken(null);
                })
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, []);

    const login = async (email: string, password: string) => {
        const res = await api("/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password }),
        });
        localStorage.setItem("token", res.data.token);
        setToken(res.data.token);
        setUser({
            id: res.data.user.id,
            email: res.data.user.email,
            fullName: res.data.user.fullName || res.data.user.full_name,
            role: res.data.user.role,
        });
        // Connect socket after login
        connectSocket();
    };

    const register = async (data: any) => {
        const res = await api("/auth/register", {
            method: "POST",
            body: JSON.stringify(data),
        });
        localStorage.setItem("token", res.data.token);
        setToken(res.data.token);
        setUser({
            id: res.data.user.id,
            email: res.data.user.email,
            fullName: res.data.user.fullName,
            role: res.data.user.role,
        });
        // Connect socket after register
        connectSocket();
    };

    const logout = () => {
        disconnectSocket();
        localStorage.removeItem("token");
        setToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
    return ctx;
};