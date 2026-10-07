import {
    createContext,
    useContext,
    useEffect,
    useState,
} from "react";

import { authClient } from "../lib/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);

    async function refreshSession() {
        try {
            const result = await authClient.getSession();

            if (result?.error) {
                console.error(
                    "Session error:",
                    result.error
                );

                setUser(null);
                setSession(null);

                return;
            }

            setUser(result?.data?.user ?? null);
            setSession(result?.data?.session ?? null);
        } catch (error) {
            console.error(
                "Failed to get auth session:",
                error
            );

            setUser(null);
            setSession(null);
        } finally {
            setLoading(false);
        }
    }

    async function logout() {
        try {
            const result = await authClient.signOut();

            if (result?.error) {
                throw new Error(
                    result.error.message ||
                    "Unable to log out."
                );
            }

            setUser(null);
            setSession(null);
        } catch (error) {
            console.error(
                "Logout error:",
                error
            );

            throw error;
        }
    }

    useEffect(() => {
        refreshSession();
    }, []);

    const value = {
        user,
        session,
        loading,
        isAuthenticated: Boolean(user),
        refreshSession,
        logout,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error(
            "useAuth must be used inside an AuthProvider."
        );
    }

    return context;
}